import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { crc32 } from './crc32.ts'
import { decodeBgcode, encodeBgcode } from './codec.ts'
import { BgcodeError } from './errors.ts'
import {
  BgcodeBlockType,
  BgcodeCompression,
  ChecksumType,
  GcodeEncoding,
  MetadataEncoding,
  concatBytes,
  encodingParameters,
  formatIni,
  readBgcodeFile,
  splitGcodeChunks,
  writeBlock,
  writeFileHeader,
} from './format.ts'
import { HEATSHRINK_11_4, HEATSHRINK_12_4, heatshrinkDecode, heatshrinkEncode } from './heatshrink.ts'
import { inflateZlib, zlibStore } from './inflate.ts'
import { meatpackDecode, meatpackEncode } from './meatpack.ts'
import { utf8Decode, utf8Encode } from './utf8.ts'

const text = (value: string): Uint8Array => utf8Encode(value)
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const base64Decode = (value: string): Uint8Array => {
  const clean = value.replace(/=+$/, '')
  const out: number[] = []
  let bits = 0
  let buffer = 0
  for (const char of clean) {
    buffer = (buffer << 6) | BASE64.indexOf(char)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out.push((buffer >> bits) & 0xff)
    }
  }
  return Uint8Array.from(out)
}
const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i])

describe('crc32', () => {
  it('matches the zlib polynomial check value', () => {
    expect(crc32(text('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array(0))).toBe(0)
  })

  it('chains over split input', () => {
    const whole = text('The quick brown fox')
    expect(crc32(whole.subarray(7), crc32(whole.subarray(0, 7)))).toBe(crc32(whole))
  })
})

describe('utf8', () => {
  test.prop([fc.string({ unit: 'grapheme' })])('round-trips any string', (value) => {
    expect(utf8Decode(utf8Encode(value))).toBe(value)
  })

  it('replaces malformed bytes', () => {
    expect(utf8Decode(Uint8Array.of(0x41, 0xff, 0x42))).toBe('A�B')
  })
})

describe('heatshrink', () => {
  it('decodes a hand-assembled stream: literals then a back-reference', () => {
    // "ab" as two literals, then copy 2 bytes from distance 2 (index 1, count 1).
    const bits = ['1', '01100001', '1', '01100010', '0', '000000000001', '0001'].join('')
    const padded = bits.padEnd(Math.ceil(bits.length / 8) * 8, '0')
    const bytes = Uint8Array.from(padded.match(/.{8}/g)!.map((byte) => Number.parseInt(byte, 2)))
    expect(utf8Decode(heatshrinkDecode(bytes, HEATSHRINK_12_4))).toBe('abab')
  })

  test.prop([fc.uint8Array({ maxLength: 3000 }), fc.constantFrom(HEATSHRINK_11_4, HEATSHRINK_12_4)])('round-trips bytes', (input, params) => {
    expect(same(heatshrinkDecode(heatshrinkEncode(input, params), params), input)).toBe(true)
  })

  it('compresses repetitive G-code well', () => {
    const input = text('G1 X10.5 Y20.25 E0.123\n'.repeat(400))
    const packed = heatshrinkEncode(input, HEATSHRINK_12_4)
    expect(packed.length).toBeLessThan(input.length / 5)
    expect(same(heatshrinkDecode(packed, HEATSHRINK_12_4, input.length), input)).toBe(true)
  })

  it('rejects a back-reference before the start of the output', () => {
    expect(() => heatshrinkDecode(Uint8Array.of(0x00, 0x00, 0x10), HEATSHRINK_12_4)).toThrow(BgcodeError)
  })
})

describe('inflate', () => {
  it('inflates a stored zlib stream', () => {
    const input = text('M104 S215\n'.repeat(2000))
    expect(same(inflateZlib(zlibStore(input)), input)).toBe(true)
  })

  it('inflates a fixed-Huffman stream produced by zlib', () => {
    // zlib.deflateSync(Buffer.from('aaaaaaaaaa')) with the default settings.
    const compressed = Uint8Array.of(0x78, 0x9c, 0x4b, 0x4c, 0x84, 0x01, 0x00, 0x14, 0xe1, 0x03, 0xcb)
    expect(utf8Decode(inflateZlib(compressed))).toBe('aaaaaaaaaa')
  })

  it('inflates a dynamic-Huffman stream produced by zlib', () => {
    // zlib.deflateSync(input, { level: 9 }) in Node 24; the second byte of the first block header says type 2.
    const input = `${Array.from({ length: 120 }, (_, i) => `G1 X${(i * 1.37).toFixed(3)} Y${i % 7} E0.0${i}`).join('\n')}\n`
    const base64 =
      'eNpNlsuRIzkMBe9jRVnwggBIfAzYGBdG/juywQIE6NaBU6Zayse/9PxbWGs9n/X8d//685eefwSx9XzoPdF7Ythez4ffE7+nDaL1fOQ9yXs62L6ez35P+z0p/Kznc97TeU8O5vV89D3pewqcaAhLiIXQpvC8MUQaI/ImsNUcVAYHy5qE0oEUezcLpQUZnJqG0oMC5M1DacIL58zHki5MCG4iShsWcAxS+vCG6iClECuWDFIasWGvRuI0YodZI3EayQLtRuI0EsKh+V+lkTDcG4nTSDb4NBKnkRwoNxKnkSgiBimNxCE6SGkkAZNBSqNNoNVIkkabsW2+QGm0Bb4bSeqbdsDUSJJGW3G8kSSNtiFOI0ka7YBwI0kanQWNQUqjw1g6SGl0BFsGKY3Ohq9G2ml0FGSNtNPoGM5upJ1GxxHUSDuNdIG9kXb9fgh6Gmmnkcr9XvQPLY10Q2KQ0kgPTAcpjdRAMkhppI6zGumkkQbcGumkkRF4N9JJI2MoNdJJIxOEz68/jexATiOdNDKFcSOdNDLHikFKIwtsHaQ08gWXQUojZ/BqJE0jFxxrJE0j34g9SUojVwg1kqaRG9QbSdPI435gXyRNo1jY3EhanSNYDFIahYB0kNIoNo4MUhrFQUysLY3CwJNrS6Nw6ATbqnXrLeSXySp2iyCTbdt1ZdiU205dN2jibVrXg/3T72/AFT4Ft0r4cvA03CriK6BTca+K3w2YjHtl/K7AdNzL7e7AhNzL7Q7BlNzL7S7BpNzL7U7BtNzL7W7BxNzL7Y7B1Ny/80SIybmXGwtkeh7ldvdggh7ldgdhih7ldhdhkh7ldidhmh7ldjdhoh7ldkdhqh7ldldhsh7ldmdhuh7ldndhwh7f8bV8PtT+fR8QdxrsZ5TL7o7D1J3qIUF3HqbvVI8JugMxhad6UNCdiGk81aOC7khM5akeFnRnIn4Ay/EOhf4AluSdCvkBLMuz8o1RgP3I4HxlFOD3mXEHY4pP34fGnYxpPn2fGnc0pvpUjw26szHdp3pu0B0O/nnYlOWdjvgBLMs7HvoDWJZ3PuQHMP78D58/AD4='
    const compressed = base64Decode(base64)
    expect((compressed[2]! >> 1) & 3).toBe(2)
    expect(utf8Decode(inflateZlib(compressed))).toBe(input)
  })

  it('rejects a non-zlib header', () => {
    expect(() => inflateZlib(Uint8Array.of(0x00, 0x00, 0x00))).toThrow(BgcodeError)
  })
})

describe('meatpack', () => {
  it('packs digits, dots, newlines, G, X and E into nibbles', () => {
    const packed = meatpackEncode(text('G1 X1.5 E2\n'), { removeComments: false })
    // enable packing, enable no-spaces, then "G1X1.5E2\n\n" packed two chars per byte, first char in the low nibble.
    expect(Array.from(packed)).toEqual([0xff, 0xff, 251, 0xff, 0xff, 247, 0x1d, 0x1e, 0x5a, 0x2b, 0xcc])
    expect(utf8Decode(meatpackDecode(packed))).toBe('G1 X1.5 E2\n')
  })

  it('keeps whole-line comments raw and drops inline comments', () => {
    const input = 'M104 S215 ; set temp\n; a comment\nG1 X1 Y2 ; move\n'
    const packed = meatpackEncode(text(input), { removeComments: false })
    expect(utf8Decode(meatpackDecode(packed))).toBe('M104 S215\n; a comment\nG1 X1 Y2\n')
  })

  it('removes comment lines entirely in MeatPack mode', () => {
    const packed = meatpackEncode(text('; only\nM107\n'), { removeComments: true })
    expect(utf8Decode(meatpackDecode(packed))).toBe('M107\n')
    expect(Array.from(packed.subarray(-3))).toEqual([0xff, 0xff, 249])
  })

  it('re-inserts spaces before parameters of G lines only', () => {
    const input = 'G29 P1 X0 Y0 W50 H20 C\nM862.3 P "MK4S"\nM486 Atemptower_v1.stl\n'
    expect(utf8Decode(meatpackDecode(meatpackEncode(text(input), { removeComments: false })))).toBe(input)
  })

  it('is idempotent on its own decoded form', () => {
    const input = text('; generated by X\nG1 X10   Y20 E0.5 ; comment\n\n\nM104 S200 ; hot\n;LAYER_CHANGE\n;Z:0.2\nG1 Z0.2 F720\n')
    const once = meatpackDecode(meatpackEncode(input, { removeComments: false }))
    const twice = meatpackDecode(meatpackEncode(once, { removeComments: false }))
    expect(utf8Decode(once)).toBe('; generated by X\nG1 X10 Y20 E0.5\nM104 S200\n;LAYER_CHANGE\n;Z:0.2\nG1 Z0.2 F720\n')
    expect(same(once, twice)).toBe(true)
  })
})

const ini = (entries: Record<string, string>): Uint8Array => formatIni(entries)

/** A small file in PrusaSlicer's block order with its default compression and encoding. */
const buildFile = (gcode: string, options: { checksum?: number; compression?: number; encoding?: number } = {}): Uint8Array => {
  const checksum = options.checksum ?? ChecksumType.CRC32
  const compression = options.compression ?? BgcodeCompression.HEATSHRINK_12_4
  const encoding = options.encoding ?? GcodeEncoding.MEATPACK_COMMENTS
  const iniParams = encodingParameters(MetadataEncoding.INI)
  const thumbnail = Uint8Array.of(0x71, 0x6f, 0x69, 0x66, 1, 2, 3, 4, 5, 6, 7, 8)
  return concatBytes([
    writeFileHeader(checksum),
    writeBlock({ type: BgcodeBlockType.FILE_METADATA, compression: BgcodeCompression.NONE, parameters: iniParams, data: ini({ Producer: 'PrusaSlicer 2.9.0', 'Produced on': '2026-01-01' }) }, checksum),
    writeBlock({ type: BgcodeBlockType.PRINTER_METADATA, compression: BgcodeCompression.NONE, parameters: iniParams, data: ini({ printer_model: 'COREONE', objects_info: '{"objects":[{"name":"temptower_v1_PLA_230to220_step5_h6_b1_m104.stl"}]}' }) }, checksum),
    writeBlock({ type: BgcodeBlockType.THUMBNAIL, compression: BgcodeCompression.NONE, parameters: Uint8Array.of(2, 0, 16, 0, 16, 0), data: thumbnail }, checksum),
    writeBlock({ type: BgcodeBlockType.PRINT_METADATA, compression: BgcodeCompression.DEFLATE, parameters: iniParams, data: ini({ 'filament used [mm]': '12.5' }) }, checksum),
    writeBlock({ type: BgcodeBlockType.SLICER_METADATA, compression: BgcodeCompression.DEFLATE, parameters: iniParams, data: ini({ temperature: '215', first_layer_temperature: '220', layer_height: '0.2' }) }, checksum),
    ...splitGcodeChunks(text(gcode)).map((chunk) =>
      writeBlock({ type: BgcodeBlockType.GCODE, compression, parameters: encodingParameters(encoding), data: encoding === GcodeEncoding.NONE ? chunk : meatpackEncode(chunk, { removeComments: encoding === GcodeEncoding.MEATPACK }) }, checksum),
    ),
  ])
}

const sampleGcode = ['; start', 'M104 S215', 'M109 S215', 'G90', 'M83', ';LAYER_CHANGE', ';Z:0.2', 'G1 Z0.2 F720', 'G1 X10 Y10 E1 F1200', 'M104 S0', ''].join('\n')

describe('bgcode container', () => {
  it('reads what it writes, metadata and G-code included', () => {
    const file = readBgcodeFile(buildFile(sampleGcode))
    expect(file.version).toBe(1)
    expect(file.blocks.map((block) => block.type)).toEqual([0, 3, 5, 4, 2, 1])
    const document = decodeBgcode(buildFile(sampleGcode))
    expect(document.text).toBe(sampleGcode)
    expect(document.metadata.file.Producer).toBe('PrusaSlicer 2.9.0')
    expect(document.metadata.printer.printer_model).toBe('COREONE')
    expect(document.metadata.print['filament used [mm]']).toBe('12.5')
    expect(document.metadata.slicer.temperature).toBe('215')
    expect(document.summary).toEqual({ version: 1, checksum: 'crc32', gcodeCompression: 'heatshrink-12-4', gcodeEncoding: 'meatpack-comments', gcodeBlocks: 1, thumbnails: 1 })
  })

  it.each([
    ['no checksum, no compression, plain encoding', { checksum: ChecksumType.NONE, compression: BgcodeCompression.NONE, encoding: GcodeEncoding.NONE }],
    ['deflate G-code blocks', { compression: BgcodeCompression.DEFLATE }],
    ['heatshrink 11/4', { compression: BgcodeCompression.HEATSHRINK_11_4 }],
  ])('round-trips with %s', (_name, options) => {
    const document = decodeBgcode(buildFile(sampleGcode, options))
    expect(document.text).toBe(sampleGcode)
    const again = decodeBgcode(encodeBgcode(document, `${document.text}M107\n`))
    expect(again.text).toBe(`${sampleGcode}M107\n`)
    expect(again.summary.gcodeCompression).toBe(document.summary.gcodeCompression)
    expect(again.summary.gcodeEncoding).toBe(document.summary.gcodeEncoding)
  })

  it('splits long G-code into 64 KiB blocks on line boundaries', () => {
    const long = 'G1 X10 Y10 E1\n'.repeat(12000)
    expect(splitGcodeChunks(text(long)).length).toBe(3)
    const document = decodeBgcode(buildFile(long))
    expect(document.summary.gcodeBlocks).toBe(3)
    expect(document.text).toBe(long)
    expect(decodeBgcode(encodeBgcode(document, document.text)).file.blocks.filter((b) => b.type === BgcodeBlockType.GCODE).length).toBe(3)
  })

  it('copies every non-G-code block byte-for-byte and keeps the block order', () => {
    const input = buildFile(sampleGcode)
    const document = decodeBgcode(input)
    const output = decodeBgcode(encodeBgcode(document, `; [temptower] header\n${document.text}`))
    const nonGcode = (blocks: typeof document.file.blocks) => blocks.filter((block) => block.type !== BgcodeBlockType.GCODE)
    const before = nonGcode(document.file.blocks)
    const after = nonGcode(output.file.blocks)
    expect(after.length).toBe(before.length)
    before.forEach((block, i) => expect(same(block.bytes, after[i]!.bytes)).toBe(true))
    expect(output.file.blocks.map((block) => block.type)).toEqual(document.file.blocks.map((block) => block.type))
  })

  it.each([
    ['too short', Uint8Array.of(0x47, 0x43, 0x44, 0x45, 1, 0, 0, 0), 'too-short'],
    ['bad magic', Uint8Array.of(0x47, 0x43, 0x44, 0x46, 1, 0, 0, 0, 1, 0), 'bad-magic'],
    ['unsupported version', Uint8Array.of(0x47, 0x43, 0x44, 0x45, 2, 0, 0, 0, 1, 0), 'unsupported-version'],
    ['unknown checksum type', Uint8Array.of(0x47, 0x43, 0x44, 0x45, 1, 0, 0, 0, 7, 0), 'unsupported-checksum'],
    ['truncated block', buildFile(sampleGcode).subarray(0, 40), 'truncated-block'],
  ])('rejects a corrupt file: %s', (_name, bytes, code) => {
    expect(() => readBgcodeFile(bytes)).toThrow(expect.objectContaining({ code }))
  })

  it('rejects a checksum mismatch and an unknown block type', () => {
    const flipped = buildFile(sampleGcode).slice()
    flipped[20] = flipped[20]! ^ 0xff
    expect(() => readBgcodeFile(flipped)).toThrow(expect.objectContaining({ code: 'checksum-mismatch' }))
    const unknownType = concatBytes([writeFileHeader(ChecksumType.NONE), Uint8Array.of(9, 0, 0, 0, 0, 0, 0, 0)])
    expect(() => readBgcodeFile(unknownType)).toThrow(expect.objectContaining({ code: 'unknown-block-type' }))
  })

  test.prop([fc.array(fc.constantFrom('G1 X1 Y2 E0.5', 'M104 S200', '; comment', ';LAYER_CHANGE', 'G1 Z0.4 F720', 'M486 Aname.stl', 'G28 W'), { maxLength: 60 })])(
    'decode(encode(text)) is a fixed point for MeatPack-canonical text',
    (lines) => {
      const canonical = lines.length === 0 ? '' : `${lines.join('\n')}\n`
      const document = decodeBgcode(buildFile(canonical))
      expect(document.text).toBe(canonical)
      expect(decodeBgcode(encodeBgcode(document, document.text)).text).toBe(canonical)
    },
  )
})
