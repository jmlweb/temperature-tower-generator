import { BgcodeError } from './errors.ts'

/**
 * Heatshrink (LZSS) as used by libbgcode: a bit stream, most significant bit
 * first, where each token is `1` + 8 literal bits, or `0` + (distance - 1) in
 * `windowBits` bits + (length - 1) in `lookaheadBits` bits. The stream ends with
 * zero padding to a byte boundary, which never forms a whole token.
 */
export interface HeatshrinkParams {
  readonly windowBits: number
  readonly lookaheadBits: number
}

export const HEATSHRINK_11_4: HeatshrinkParams = { windowBits: 11, lookaheadBits: 4 }
export const HEATSHRINK_12_4: HeatshrinkParams = { windowBits: 12, lookaheadBits: 4 }

/** libbgcode only emits matches longer than the token size in bytes: (1 + windowBits + lookaheadBits) / 8. */
const MIN_MATCH = 3
const MAX_CHAIN = 64

export const heatshrinkDecode = (input: Uint8Array, { windowBits, lookaheadBits }: HeatshrinkParams, expectedSize?: number): Uint8Array => {
  let out = new Uint8Array(expectedSize ?? Math.max(64, input.length * 4))
  let outLength = 0
  const push = (byte: number): void => {
    if (outLength === out.length) {
      const grown = new Uint8Array(out.length * 2)
      grown.set(out)
      out = grown
    }
    out[outLength++] = byte
  }

  const totalBits = input.length * 8
  let bitPos = 0
  const readBits = (count: number): number => {
    let value = 0
    for (let i = 0; i < count; i += 1) {
      const byte = input[bitPos >> 3]!
      value = (value << 1) | ((byte >> (7 - (bitPos & 7))) & 1)
      bitPos += 1
    }
    return value
  }

  const backrefBits = windowBits + lookaheadBits
  while (bitPos < totalBits) {
    const tag = readBits(1)
    if (tag === 1) {
      if (totalBits - bitPos < 8) break
      push(readBits(8))
      continue
    }
    if (totalBits - bitPos < backrefBits) break
    const distance = readBits(windowBits) + 1
    const length = readBits(lookaheadBits) + 1
    if (distance > outLength) throw new BgcodeError('heatshrink-backref', `Heatshrink back-reference of ${distance} bytes at output offset ${outLength}`)
    for (let i = 0; i < length; i += 1) push(out[outLength - distance]!)
  }
  return out.subarray(0, outLength)
}

export const heatshrinkEncode = (input: Uint8Array, { windowBits, lookaheadBits }: HeatshrinkParams): Uint8Array => {
  const windowSize = 1 << windowBits
  const maxMatch = 1 << lookaheadBits
  let out = new Uint8Array(Math.max(64, input.length + (input.length >> 3) + 16))
  let outLength = 0
  let bitBuffer = 0
  let bitCount = 0
  const writeBits = (value: number, count: number): void => {
    for (let i = count - 1; i >= 0; i -= 1) {
      bitBuffer = (bitBuffer << 1) | ((value >> i) & 1)
      bitCount += 1
      if (bitCount === 8) {
        if (outLength === out.length) {
          const grown = new Uint8Array(out.length * 2)
          grown.set(out)
          out = grown
        }
        out[outLength++] = bitBuffer
        bitBuffer = 0
        bitCount = 0
      }
    }
  }

  // Hash chains over 3-byte prefixes keep the match search linear in practice.
  const head = new Int32Array(1 << 15).fill(-1)
  const prev = new Int32Array(input.length)
  const hashAt = (i: number): number => ((input[i]! << 10) ^ (input[i + 1]! << 5) ^ input[i + 2]!) & 0x7fff
  const insert = (i: number): void => {
    if (i + MIN_MATCH > input.length) return
    const h = hashAt(i)
    prev[i] = head[h]!
    head[h] = i
  }

  let i = 0
  while (i < input.length) {
    let bestLength = 0
    let bestDistance = 0
    if (i + MIN_MATCH <= input.length) {
      const limit = Math.min(maxMatch, input.length - i)
      let candidate = head[hashAt(i)]!
      let chain = 0
      while (candidate >= 0 && i - candidate <= windowSize && chain < MAX_CHAIN) {
        let length = 0
        while (length < limit && input[candidate + length] === input[i + length]) length += 1
        if (length > bestLength) {
          bestLength = length
          bestDistance = i - candidate
          if (length === limit) break
        }
        candidate = prev[candidate]!
        chain += 1
      }
    }
    if (bestLength >= MIN_MATCH) {
      writeBits(0, 1)
      writeBits(bestDistance - 1, windowBits)
      writeBits(bestLength - 1, lookaheadBits)
      for (let k = 0; k < bestLength; k += 1) insert(i + k)
      i += bestLength
    } else {
      writeBits(1, 1)
      writeBits(input[i]!, 8)
      insert(i)
      i += 1
    }
  }
  if (bitCount > 0) writeBits(0, 8 - bitCount)
  return out.subarray(0, outLength)
}
