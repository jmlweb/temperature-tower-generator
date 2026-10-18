import { BgcodeError } from './errors.ts'
import {
  BgcodeBlockType,
  BgcodeCompression,
  ChecksumType,
  GcodeEncoding,
  MetadataEncoding,
  concatBytes,
  decodeGcodeBlock,
  decompressBlock,
  encodeGcodeBytes,
  encodingParameters,
  gcodeEncodingOf,
  metadataEncodingOf,
  parseIni,
  readBgcodeFile,
  splitGcodeChunks,
  writeBlock,
  writeFileHeader,
  type BgcodeBlock,
  type BgcodeFile,
} from './format.ts'
import { utf8Decode, utf8Encode } from './utf8.ts'

export interface BgcodeMetadata {
  /** `Producer`, `Produced on`. */
  readonly file: Readonly<Record<string, string>>
  /** `printer_model`, `filament_type`, `objects_info`, ... */
  readonly printer: Readonly<Record<string, string>>
  /** Filament use and time estimates. */
  readonly print: Readonly<Record<string, string>>
  /** The full slicer config, what plain G-code carries as `; key = value` lines. */
  readonly slicer: Readonly<Record<string, string>>
  /** PrusaSlicer 3 adds a JSON config block next to the INI one. */
  readonly slicerJson: string | null
}

export interface BgcodeSummary {
  readonly version: number
  readonly checksum: 'none' | 'crc32'
  readonly gcodeCompression: 'none' | 'deflate' | 'heatshrink-11-4' | 'heatshrink-12-4'
  readonly gcodeEncoding: 'none' | 'meatpack' | 'meatpack-comments'
  readonly gcodeBlocks: number
  readonly thumbnails: number
}

/** A decoded `.bgcode`: the raw container, parsed metadata, and the G-code text of all G-code blocks. */
export interface BgcodeDocument {
  readonly file: BgcodeFile
  readonly metadata: BgcodeMetadata
  readonly text: string
  readonly summary: BgcodeSummary
}

const compressionName = (compression: number): BgcodeSummary['gcodeCompression'] => {
  switch (compression) {
    case BgcodeCompression.DEFLATE:
      return 'deflate'
    case BgcodeCompression.HEATSHRINK_11_4:
      return 'heatshrink-11-4'
    case BgcodeCompression.HEATSHRINK_12_4:
      return 'heatshrink-12-4'
    default:
      return 'none'
  }
}

const encodingName = (encoding: number): BgcodeSummary['gcodeEncoding'] => {
  switch (encoding) {
    case GcodeEncoding.MEATPACK:
      return 'meatpack'
    case GcodeEncoding.MEATPACK_COMMENTS:
      return 'meatpack-comments'
    default:
      return 'none'
  }
}

const readMetadata = (blocks: readonly BgcodeBlock[], type: number): Record<string, string> => {
  const entries: Record<string, string> = {}
  for (const block of blocks) {
    if (block.type !== type || metadataEncodingOf(block) !== MetadataEncoding.INI) continue
    Object.assign(entries, parseIni(decompressBlock(block)))
  }
  return entries
}

export const decodeBgcode = (bytes: Uint8Array): BgcodeDocument => {
  const file = readBgcodeFile(bytes)
  const gcodeBlocks = file.blocks.filter((block) => block.type === BgcodeBlockType.GCODE)
  const text = utf8Decode(concatBytes(gcodeBlocks.map(decodeGcodeBlock)))
  const jsonBlock = file.blocks.find((block) => block.type === BgcodeBlockType.SLICER_METADATA && metadataEncodingOf(block) === MetadataEncoding.JSON)
  const first = gcodeBlocks[0]
  return {
    file,
    metadata: {
      file: readMetadata(file.blocks, BgcodeBlockType.FILE_METADATA),
      printer: readMetadata(file.blocks, BgcodeBlockType.PRINTER_METADATA),
      print: readMetadata(file.blocks, BgcodeBlockType.PRINT_METADATA),
      slicer: readMetadata(file.blocks, BgcodeBlockType.SLICER_METADATA),
      slicerJson: jsonBlock ? utf8Decode(decompressBlock(jsonBlock)) : null,
    },
    text,
    summary: {
      version: file.version,
      checksum: file.checksumType === ChecksumType.CRC32 ? 'crc32' : 'none',
      gcodeCompression: compressionName(first?.compression ?? BgcodeCompression.NONE),
      gcodeEncoding: encodingName(first ? gcodeEncodingOf(first) : GcodeEncoding.NONE),
      gcodeBlocks: gcodeBlocks.length,
      thumbnails: file.blocks.filter((block) => block.type === BgcodeBlockType.THUMBNAIL).length,
    },
  }
}

/**
 * Writes a new `.bgcode` with `text` as its G-code: every non-G-code block is
 * copied byte-for-byte in its original position, and the G-code blocks are
 * re-encoded with the compression and encoding of the input's first G-code block.
 */
export const encodeBgcode = (input: BgcodeDocument, text: string): Uint8Array => {
  const { file } = input
  const template = file.blocks.find((block) => block.type === BgcodeBlockType.GCODE)
  const compression = template?.compression ?? BgcodeCompression.HEATSHRINK_12_4
  const encoding = template ? gcodeEncodingOf(template) : GcodeEncoding.MEATPACK_COMMENTS
  if (!Object.values(GcodeEncoding).includes(encoding as GcodeEncoding)) throw new BgcodeError('unknown-encoding', `Unknown G-code encoding ${encoding}`)

  const gcodeBlocks = splitGcodeChunks(utf8Encode(text)).map((chunk) =>
    writeBlock({ type: BgcodeBlockType.GCODE, compression, parameters: encodingParameters(encoding), data: encodeGcodeBytes(chunk, encoding) }, file.checksumType),
  )

  const parts: Uint8Array[] = [writeFileHeader(file.checksumType)]
  let gcodeWritten = false
  for (const block of file.blocks) {
    if (block.type !== BgcodeBlockType.GCODE) {
      parts.push(block.bytes)
      continue
    }
    if (!gcodeWritten) {
      parts.push(...gcodeBlocks)
      gcodeWritten = true
    }
  }
  if (!gcodeWritten) parts.push(...gcodeBlocks)
  return concatBytes(parts)
}
