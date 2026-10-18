import { crc32 } from './crc32.ts'
import { BgcodeError } from './errors.ts'
import { HEATSHRINK_11_4, HEATSHRINK_12_4, heatshrinkDecode, heatshrinkEncode } from './heatshrink.ts'
import { inflateZlib, zlibStore } from './inflate.ts'
import { meatpackDecode, meatpackEncode } from './meatpack.ts'
import { utf8Decode, utf8Encode } from './utf8.ts'

/**
 * Binary G-code container (prusa3d/libbgcode, format version 1): a 10-byte file
 * header, then blocks of `type, compression, uncompressed size[, compressed
 * size]`, type-specific parameters, data and an optional CRC32 over all of it.
 * Integers are little-endian.
 */
export const BgcodeBlockType = {
  FILE_METADATA: 0,
  GCODE: 1,
  SLICER_METADATA: 2,
  PRINTER_METADATA: 3,
  PRINT_METADATA: 4,
  THUMBNAIL: 5,
} as const
export type BgcodeBlockType = (typeof BgcodeBlockType)[keyof typeof BgcodeBlockType]

export const BgcodeCompression = {
  NONE: 0,
  DEFLATE: 1,
  HEATSHRINK_11_4: 2,
  HEATSHRINK_12_4: 3,
} as const
export type BgcodeCompression = (typeof BgcodeCompression)[keyof typeof BgcodeCompression]

export const GcodeEncoding = {
  NONE: 0,
  MEATPACK: 1,
  MEATPACK_COMMENTS: 2,
} as const
export type GcodeEncoding = (typeof GcodeEncoding)[keyof typeof GcodeEncoding]

export const MetadataEncoding = { INI: 0, JSON: 1 } as const
export type MetadataEncoding = (typeof MetadataEncoding)[keyof typeof MetadataEncoding]

export const ChecksumType = { NONE: 0, CRC32: 1 } as const
export type ChecksumType = (typeof ChecksumType)[keyof typeof ChecksumType]

export const BGCODE_MAGIC = [0x47, 0x43, 0x44, 0x45] as const // "GCDE"
export const BGCODE_VERSION = 1
/** libbgcode's default G-code cache: text is split into blocks of at most this many bytes, on line boundaries. */
export const GCODE_BLOCK_SIZE = 65536

const FILE_HEADER_SIZE = 10
const CHECKSUM_SIZE = 4

export interface BgcodeBlock {
  readonly type: number
  readonly compression: number
  readonly uncompressedSize: number
  /** Null when the block is not compressed. */
  readonly compressedSize: number | null
  /** Type-specific parameters: `encoding` (2 bytes) or thumbnail `format, width, height` (6 bytes). */
  readonly parameters: Uint8Array
  /** Data as stored in the file (still compressed and encoded). */
  readonly payload: Uint8Array
  /** The whole block as stored, checksum included, for byte-for-byte copying. */
  readonly bytes: Uint8Array
}

export interface BgcodeFile {
  readonly version: number
  readonly checksumType: number
  readonly blocks: readonly BgcodeBlock[]
}

const readUint16 = (bytes: Uint8Array, offset: number): number => bytes[offset]! | (bytes[offset + 1]! << 8)
const readUint32 = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0

const parametersSize = (type: number): number => {
  switch (type) {
    case BgcodeBlockType.FILE_METADATA:
    case BgcodeBlockType.GCODE:
    case BgcodeBlockType.SLICER_METADATA:
    case BgcodeBlockType.PRINTER_METADATA:
    case BgcodeBlockType.PRINT_METADATA:
      return 2
    case BgcodeBlockType.THUMBNAIL:
      return 6
    default:
      throw new BgcodeError('unknown-block-type', `Unknown block type ${type}`)
  }
}

const isKnownCompression = (compression: number): boolean => Object.values(BgcodeCompression).includes(compression as BgcodeCompression)

export const hasBgcodeMagic = (bytes: Uint8Array): boolean => BGCODE_MAGIC.every((byte, i) => bytes[i] === byte)

/** Parses the container and verifies checksums; block data stays as stored. */
export const readBgcodeFile = (bytes: Uint8Array): BgcodeFile => {
  if (bytes.length < FILE_HEADER_SIZE) throw new BgcodeError('too-short', `File is ${bytes.length} bytes, shorter than the 10-byte header`)
  if (!hasBgcodeMagic(bytes)) throw new BgcodeError('bad-magic', 'File does not start with the GCDE magic')
  const version = readUint32(bytes, 4)
  if (version !== BGCODE_VERSION) throw new BgcodeError('unsupported-version', `Binary G-code version ${version} is not supported (expected ${BGCODE_VERSION})`)
  const checksumType = readUint16(bytes, 8)
  if (checksumType !== ChecksumType.NONE && checksumType !== ChecksumType.CRC32) {
    throw new BgcodeError('unsupported-checksum', `Checksum type ${checksumType} is not supported`)
  }

  const blocks: BgcodeBlock[] = []
  let pos = FILE_HEADER_SIZE
  while (pos < bytes.length) {
    const start = pos
    if (pos + 8 > bytes.length) throw new BgcodeError('truncated-block', `Block header at byte ${pos} is cut off`)
    const type = readUint16(bytes, pos)
    const compression = readUint16(bytes, pos + 2)
    const uncompressedSize = readUint32(bytes, pos + 4)
    pos += 8
    if (!isKnownCompression(compression)) throw new BgcodeError('unknown-compression', `Unknown compression type ${compression} in block ${blocks.length}`)
    let compressedSize: number | null = null
    if (compression !== BgcodeCompression.NONE) {
      if (pos + 4 > bytes.length) throw new BgcodeError('truncated-block', `Block header at byte ${start} is cut off`)
      compressedSize = readUint32(bytes, pos)
      pos += 4
    }
    const paramsSize = parametersSize(type)
    const dataSize = compressedSize ?? uncompressedSize
    const checksumSize = checksumType === ChecksumType.CRC32 ? CHECKSUM_SIZE : 0
    const end = pos + paramsSize + dataSize + checksumSize
    if (end > bytes.length) throw new BgcodeError('truncated-block', `Block ${blocks.length} claims ${dataSize} bytes of data but the file ends first`)
    const parameters = bytes.subarray(pos, pos + paramsSize)
    const payload = bytes.subarray(pos + paramsSize, pos + paramsSize + dataSize)
    if (checksumType === ChecksumType.CRC32) {
      const expected = readUint32(bytes, end - CHECKSUM_SIZE)
      const actual = crc32(bytes.subarray(start, end - CHECKSUM_SIZE))
      if (expected !== actual) throw new BgcodeError('checksum-mismatch', `Block ${blocks.length} checksum mismatch (stored ${expected.toString(16)}, computed ${actual.toString(16)})`)
    }
    blocks.push({ type, compression, uncompressedSize, compressedSize, parameters, payload, bytes: bytes.subarray(start, end) })
    pos = end
  }
  return { version, checksumType, blocks }
}

export const decompressBlock = (block: BgcodeBlock): Uint8Array => {
  let data: Uint8Array
  switch (block.compression) {
    case BgcodeCompression.NONE:
      data = block.payload
      break
    case BgcodeCompression.DEFLATE:
      data = inflateZlib(block.payload, block.uncompressedSize)
      break
    case BgcodeCompression.HEATSHRINK_11_4:
      data = heatshrinkDecode(block.payload, HEATSHRINK_11_4, block.uncompressedSize)
      break
    case BgcodeCompression.HEATSHRINK_12_4:
      data = heatshrinkDecode(block.payload, HEATSHRINK_12_4, block.uncompressedSize)
      break
    default:
      throw new BgcodeError('unknown-compression', `Unknown compression type ${block.compression}`)
  }
  if (data.length !== block.uncompressedSize) {
    throw new BgcodeError('size-mismatch', `Block decompressed to ${data.length} bytes, header says ${block.uncompressedSize}`)
  }
  return data
}

/** The core's own compressors; callers with a real Deflate (Node's zlib) can pass theirs to `writeBlock`. */
export const compressData = (data: Uint8Array, compression: number): Uint8Array => {
  switch (compression) {
    case BgcodeCompression.NONE:
      return data
    case BgcodeCompression.DEFLATE:
      return zlibStore(data)
    case BgcodeCompression.HEATSHRINK_11_4:
      return heatshrinkEncode(data, HEATSHRINK_11_4)
    case BgcodeCompression.HEATSHRINK_12_4:
      return heatshrinkEncode(data, HEATSHRINK_12_4)
    default:
      throw new BgcodeError('unknown-compression', `Unknown compression type ${compression}`)
  }
}

/** Decodes the G-code bytes of one block (MeatPack or plain). */
export const decodeGcodeBlock = (block: BgcodeBlock): Uint8Array => {
  const encoding = readUint16(block.parameters, 0)
  const data = decompressBlock(block)
  switch (encoding) {
    case GcodeEncoding.NONE:
      return data
    case GcodeEncoding.MEATPACK:
    case GcodeEncoding.MEATPACK_COMMENTS:
      return meatpackDecode(data)
    default:
      throw new BgcodeError('unknown-encoding', `Unknown G-code encoding ${encoding}`)
  }
}

export const encodeGcodeBytes = (text: Uint8Array, encoding: number): Uint8Array => {
  switch (encoding) {
    case GcodeEncoding.NONE:
      return text
    case GcodeEncoding.MEATPACK:
      return meatpackEncode(text, { removeComments: true })
    case GcodeEncoding.MEATPACK_COMMENTS:
      return meatpackEncode(text, { removeComments: false })
    default:
      throw new BgcodeError('unknown-encoding', `Unknown G-code encoding ${encoding}`)
  }
}

/** Splits G-code text on line boundaries into chunks of at most `limit` bytes, as libbgcode's G-code cache does. */
export const splitGcodeChunks = (text: Uint8Array, limit = GCODE_BLOCK_SIZE): readonly Uint8Array[] => {
  const chunks: Uint8Array[] = []
  let chunkStart = 0
  let lineStart = 0
  while (lineStart < text.length) {
    let lineEnd = text.indexOf(0x0a, lineStart)
    lineEnd = lineEnd === -1 ? text.length : lineEnd + 1
    const lineSize = lineEnd - lineStart
    if (lineSize > limit) throw new BgcodeError('line-too-long', `A G-code line of ${lineSize} bytes exceeds the ${limit}-byte block size`)
    if (lineEnd - chunkStart > limit) {
      chunks.push(text.subarray(chunkStart, lineStart))
      chunkStart = lineStart
    }
    lineStart = lineEnd
  }
  if (chunkStart < text.length) chunks.push(text.subarray(chunkStart))
  return chunks
}

export interface BlockSpec {
  readonly type: number
  readonly compression: number
  readonly parameters: Uint8Array
  readonly data: Uint8Array
}

/** Serializes one block: header, parameters, data (compressed here) and the checksum. */
export const writeBlock = ({ type, compression, parameters, data }: BlockSpec, checksumType: number, compress: typeof compressData = compressData): Uint8Array => {
  const compressed = compress(data, compression)
  const headerSize = compression === BgcodeCompression.NONE ? 8 : 12
  const checksumSize = checksumType === ChecksumType.CRC32 ? CHECKSUM_SIZE : 0
  const out = new Uint8Array(headerSize + parameters.length + compressed.length + checksumSize)
  const view = new DataView(out.buffer)
  view.setUint16(0, type, true)
  view.setUint16(2, compression, true)
  view.setUint32(4, data.length, true)
  if (compression !== BgcodeCompression.NONE) view.setUint32(8, compressed.length, true)
  out.set(parameters, headerSize)
  out.set(compressed, headerSize + parameters.length)
  if (checksumType === ChecksumType.CRC32) {
    view.setUint32(out.length - CHECKSUM_SIZE, crc32(out.subarray(0, out.length - CHECKSUM_SIZE)), true)
  }
  return out
}

export const encodingParameters = (encoding: number): Uint8Array => Uint8Array.of(encoding & 0xff, encoding >> 8)

export const writeFileHeader = (checksumType: number): Uint8Array => {
  const out = new Uint8Array(FILE_HEADER_SIZE)
  out.set(BGCODE_MAGIC)
  new DataView(out.buffer).setUint32(4, BGCODE_VERSION, true)
  new DataView(out.buffer).setUint16(8, checksumType, true)
  return out
}

export const concatBytes = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let pos = 0
  for (const part of parts) {
    out.set(part, pos)
    pos += part.length
  }
  return out
}

/** `key=value` lines of an INI metadata block. */
export const parseIni = (bytes: Uint8Array): Record<string, string> => {
  const entries: Record<string, string> = {}
  for (const line of utf8Decode(bytes).split('\n')) {
    const separator = line.indexOf('=')
    if (separator === -1) continue
    entries[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
  }
  return entries
}

export const formatIni = (entries: Readonly<Record<string, string>>): Uint8Array =>
  utf8Encode(
    Object.entries(entries)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(''),
  )

export const metadataEncodingOf = (block: BgcodeBlock): number => readUint16(block.parameters, 0)
export const gcodeEncodingOf = (block: BgcodeBlock): number => readUint16(block.parameters, 0)
