import { BgcodeError } from './errors.ts'

/**
 * zlib inflate (RFC 1950 wrapper around RFC 1951 deflate) for the metadata
 * blocks PrusaSlicer compresses with Deflate. Output side only: the transform
 * never re-compresses metadata, and new G-code blocks that ask for Deflate are
 * written as stored blocks by `zlibStore`.
 */
const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

interface Huffman {
  readonly counts: Uint16Array
  readonly symbols: Uint16Array
}

const buildHuffman = (lengths: ArrayLike<number>): Huffman => {
  const counts = new Uint16Array(16)
  for (let i = 0; i < lengths.length; i += 1) counts[lengths[i]!] = (counts[lengths[i]!] ?? 0) + 1
  counts[0] = 0
  const offsets = new Uint16Array(16)
  for (let len = 1; len < 16; len += 1) offsets[len] = offsets[len - 1]! + counts[len - 1]!
  const symbols = new Uint16Array(lengths.length)
  for (let i = 0; i < lengths.length; i += 1) {
    const len = lengths[i]!
    if (len !== 0) symbols[offsets[len]!++] = i
  }
  return { counts, symbols }
}

const FIXED_LITERAL = buildHuffman([...Array.from({ length: 144 }, () => 8), ...Array.from({ length: 112 }, () => 9), ...Array.from({ length: 24 }, () => 7), ...Array.from({ length: 8 }, () => 8)])
const FIXED_DISTANCE = buildHuffman(Array.from({ length: 30 }, () => 5))

const fail = (message: string): never => {
  throw new BgcodeError('inflate', message)
}

export const inflateZlib = (input: Uint8Array, expectedSize?: number): Uint8Array => {
  if (input.length < 2) fail('zlib stream too short')
  const cmf = input[0]!
  const flg = input[1]!
  if ((cmf & 0x0f) !== 8 || ((cmf << 8) | flg) % 31 !== 0) fail('not a zlib stream')
  if (flg & 0x20) fail('zlib preset dictionary is not supported')

  let out = new Uint8Array(expectedSize ?? Math.max(256, input.length * 4))
  let outLength = 0
  const push = (byte: number): void => {
    if (outLength === out.length) {
      const grown = new Uint8Array(out.length * 2)
      grown.set(out)
      out = grown
    }
    out[outLength++] = byte
  }

  let pos = 2
  let bitBuffer = 0
  let bitCount = 0
  const readBit = (): number => {
    if (bitCount === 0) {
      if (pos >= input.length) fail('unexpected end of deflate stream')
      bitBuffer = input[pos++]!
      bitCount = 8
    }
    const bit = bitBuffer & 1
    bitBuffer >>= 1
    bitCount -= 1
    return bit
  }
  const readBits = (count: number): number => {
    let value = 0
    for (let i = 0; i < count; i += 1) value |= readBit() << i
    return value
  }
  const decodeSymbol = ({ counts, symbols }: Huffman): number => {
    let code = 0
    let first = 0
    let index = 0
    for (let len = 1; len < 16; len += 1) {
      code |= readBit()
      const count = counts[len]!
      if (code - first < count) return symbols[index + (code - first)]!
      index += count
      first += count
      first <<= 1
      code <<= 1
    }
    return fail('invalid Huffman code')
  }
  const inflateBlock = (literal: Huffman, distance: Huffman): void => {
    for (;;) {
      const symbol = decodeSymbol(literal)
      if (symbol < 256) {
        push(symbol)
        continue
      }
      if (symbol === 256) return
      const lengthIndex = symbol - 257
      if (lengthIndex >= LENGTH_BASE.length) fail('invalid length symbol')
      const length = LENGTH_BASE[lengthIndex]! + readBits(LENGTH_EXTRA[lengthIndex]!)
      const distIndex = decodeSymbol(distance)
      if (distIndex >= DIST_BASE.length) fail('invalid distance symbol')
      const dist = DIST_BASE[distIndex]! + readBits(DIST_EXTRA[distIndex]!)
      if (dist > outLength) fail('deflate distance beyond output')
      for (let i = 0; i < length; i += 1) push(out[outLength - dist]!)
    }
  }

  let final = 0
  do {
    final = readBit()
    const type = readBits(2)
    if (type === 0) {
      bitBuffer = 0
      bitCount = 0
      if (pos + 4 > input.length) fail('truncated stored block')
      const len = input[pos]! | (input[pos + 1]! << 8)
      const nlen = input[pos + 2]! | (input[pos + 3]! << 8)
      if ((len ^ 0xffff) !== nlen) fail('stored block length mismatch')
      pos += 4
      if (pos + len > input.length) fail('truncated stored block')
      for (let i = 0; i < len; i += 1) push(input[pos + i]!)
      pos += len
    } else if (type === 1) {
      inflateBlock(FIXED_LITERAL, FIXED_DISTANCE)
    } else if (type === 2) {
      const hlit = readBits(5) + 257
      const hdist = readBits(5) + 1
      const hclen = readBits(4) + 4
      const codeLengths = new Uint8Array(19)
      for (let i = 0; i < hclen; i += 1) codeLengths[CODE_LENGTH_ORDER[i]!] = readBits(3)
      const codeHuffman = buildHuffman(codeLengths)
      const lengths = new Uint8Array(hlit + hdist)
      let n = 0
      while (n < hlit + hdist) {
        const symbol = decodeSymbol(codeHuffman)
        if (symbol < 16) {
          lengths[n++] = symbol
        } else if (symbol === 16) {
          if (n === 0) fail('repeat with no previous length')
          const previous = lengths[n - 1]!
          for (let repeat = 3 + readBits(2); repeat > 0; repeat -= 1) lengths[n++] = previous
        } else if (symbol === 17) {
          n += 3 + readBits(3)
        } else {
          n += 11 + readBits(7)
        }
      }
      if (n > hlit + hdist) fail('code lengths overflow')
      inflateBlock(buildHuffman(lengths.subarray(0, hlit)), buildHuffman(lengths.subarray(hlit)))
    } else {
      fail('invalid deflate block type')
    }
  } while (!final)

  return out.subarray(0, outLength)
}

const adler32 = (bytes: Uint8Array): number => {
  let a = 1
  let b = 0
  for (let i = 0; i < bytes.length; i += 1) {
    a = (a + bytes[i]!) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

/** A valid zlib stream made of stored (uncompressed) deflate blocks. */
export const zlibStore = (input: Uint8Array): Uint8Array => {
  const blockCount = Math.max(1, Math.ceil(input.length / 65535))
  const out = new Uint8Array(2 + input.length + blockCount * 5 + 4)
  out[0] = 0x78
  out[1] = 0x01
  let pos = 2
  for (let block = 0; block < blockCount; block += 1) {
    const start = block * 65535
    const len = Math.min(65535, input.length - start)
    out[pos++] = block === blockCount - 1 ? 1 : 0
    out[pos++] = len & 0xff
    out[pos++] = len >> 8
    out[pos++] = ~len & 0xff
    out[pos++] = (~len >> 8) & 0xff
    out.set(input.subarray(start, start + len), pos)
    pos += len
  }
  const sum = adler32(input)
  out[pos++] = sum >>> 24
  out[pos++] = (sum >>> 16) & 0xff
  out[pos++] = (sum >>> 8) & 0xff
  out[pos++] = sum & 0xff
  return out.subarray(0, pos)
}
