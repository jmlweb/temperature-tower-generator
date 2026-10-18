import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BgcodeBlockType, decodeBgcode, decodeGcodeBlock, decompressBlock, encodeBgcode, encodeGcodeBytes, gcodeEncodingOf } from '../src/bgcode/index.ts'

/**
 * Checks the codec against prusa3d/libbgcode's own test data (AGPL, not
 * vendored): set BGCODE_REFERENCE_DIR to a folder holding `tests/data/*` from
 * that repository. `mini_cube_ps2.8.1.bgcode` was written by PrusaSlicer 2.8.1
 * and `mini_cube_b.bgcode` by libbgcode's converter; the `_ref.gcode` files are
 * the text libbgcode decodes them to.
 */
const dir = process.env.BGCODE_REFERENCE_DIR
const available = dir !== undefined && existsSync(join(dir, 'mini_cube_ps2.8.1.bgcode'))

describe.skipIf(!available)('libbgcode reference files', () => {
  const load = (name: string) => new Uint8Array(readFileSync(join(dir!, name)))
  // libbgcode's text conversion drops comment lines with no content (`;`, `; `); the decoder keeps them.
  const isContentLine = (line: string): boolean => !/^;?[ \t]*$/.test(line)
  const referenceLines = (name: string) => readFileSync(join(dir!, name), 'utf8').split('\n').filter(isContentLine)

  it.each(['mini_cube_ps2.8.1', 'mini_cube_b'])('%s decodes to the published text', (name) => {
    const document = decodeBgcode(load(`${name}.bgcode`))
    const decoded = document.text.split('\n').filter(isContentLine)
    const reference = referenceLines(`${name}_ref.gcode`)
    const start = reference.indexOf(decoded[0]!)
    expect(start).toBeGreaterThanOrEqual(0)
    expect(reference.slice(start, start + decoded.length)).toEqual(decoded)
    expect(document.metadata.file.Producer).toMatch(/^PrusaSlicer /)
  })

  it('re-encodes mini_cube_b to the same MeatPack bytes libbgcode wrote', () => {
    const document = decodeBgcode(load('mini_cube_b.bgcode'))
    for (const block of document.file.blocks.filter((b) => b.type === BgcodeBlockType.GCODE)) {
      const packed = decompressBlock(block)
      const repacked = encodeGcodeBytes(decodeGcodeBlock(block), gcodeEncodingOf(block))
      expect(Array.from(repacked)).toEqual(Array.from(packed))
    }
  })

  it.each(['mini_cube_ps2.8.1', 'mini_cube_b'])('%s survives a full re-encode', (name) => {
    const document = decodeBgcode(load(`${name}.bgcode`))
    const again = decodeBgcode(encodeBgcode(document, document.text))
    expect(again.text).toBe(document.text)
    expect(again.file.blocks.length).toBe(document.file.blocks.length)
  })
})
