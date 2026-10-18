import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { BgcodeBlockType, decodeBgcode, loadGcodeFile, processGcode, utf8Decode, type TowerConfig } from '@temptower/core'
import { describe, expect, it } from 'vitest'

/**
 * Each `<variant>.config.json` under `fixtures/<slicer>/` describes one fixture:
 * - `gcode`: the input file name (defaults to `<variant>.gcode`), so several
 *   configs can share one sliced file; a `.bgcode` input exercises ADR-0007;
 * - `config`: the tower config used for the transform;
 * - `expect.errors` / `expect.warnings`: the ADR-0004 codes the report must list.
 * `pnpm fixture` writes `<variant>.report.json` and, for valid inputs,
 * `<variant>.golden.gcode` (the transformed text, decoded for binary input);
 * `pnpm test` checks them.
 */
interface FixtureSpec {
  readonly gcode?: string
  readonly config: TowerConfig
  readonly expect?: { readonly errors?: readonly string[]; readonly warnings?: readonly string[] }
  readonly source?: string
  readonly notes?: string
}

const root = import.meta.dirname
const slicerDirs = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())

for (const slicerDir of slicerDirs) {
  const dir = join(root, slicerDir.name)
  const specs = readdirSync(dir).filter((name) => name.endsWith('.config.json')).sort()

  describe(`${slicerDir.name} fixtures`, () => {
    for (const specName of specs) {
      const variant = basename(specName, '.config.json')
      const spec = JSON.parse(readFileSync(join(dir, specName), 'utf8')) as FixtureSpec
      const gcodeName = spec.gcode ?? `${variant}.gcode`

      it(variant, async () => {
        const bytes = new Uint8Array(readFileSync(join(dir, gcodeName)))
        const file = loadGcodeFile({ fileName: gcodeName, bytes })
        const result = processGcode({ file, config: spec.config })

        expect(result.report.errors.map((issue) => issue.code).sort()).toEqual([...(spec.expect?.errors ?? [])].sort())
        expect(result.report.warnings.map((issue) => issue.code).sort()).toEqual([...(spec.expect?.warnings ?? [])].sort())

        await expect(JSON.stringify(result.report, null, 2)).toMatchFileSnapshot(join(dir, `${variant}.report.json`))

        const goldenPath = join(dir, `${variant}.golden.gcode`)
        if (result.output === null) {
          expect(result.report.canDownload).toBe(false)
          expect(result.outputBytes).toBeNull()
          expect(existsSync(goldenPath), 'an error fixture produces no output file').toBe(false)
          return
        }
        expect(result.report.canDownload).toBe(true)
        expect(result.output.startsWith('; [temptower] ')).toBe(true)
        await expect(result.output).toMatchFileSnapshot(goldenPath)

        if (file.binary === null) {
          expect(result.outputFileName.endsWith('_temptower.gcode')).toBe(true)
          expect(utf8Decode(result.outputBytes!)).toBe(result.output)
          return
        }
        // Binary output decodes back to the golden text, and every non-G-code block is the input's, byte for byte (ADR-0007).
        expect(result.outputFileName.endsWith('_temptower.bgcode')).toBe(true)
        const output = decodeBgcode(result.outputBytes!)
        expect(output.text).toBe(result.output)
        expect(output.summary.gcodeCompression).toBe(file.binary.summary.gcodeCompression)
        expect(output.summary.gcodeEncoding).toBe(file.binary.summary.gcodeEncoding)
        const nonGcode = (blocks: typeof output.file.blocks) => blocks.filter((block) => block.type !== BgcodeBlockType.GCODE)
        const inputBlocks = nonGcode(file.binary.file.blocks)
        const outputBlocks = nonGcode(output.file.blocks)
        expect(outputBlocks.length).toBe(inputBlocks.length)
        inputBlocks.forEach((block, i) => expect(Buffer.from(outputBlocks[i]!.bytes).equals(Buffer.from(block.bytes))).toBe(true))
      })
    }
  })
}
