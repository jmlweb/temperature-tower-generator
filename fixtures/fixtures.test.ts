import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { isBinaryGcode, processGcode, type TowerConfig } from '@temptower/core'
import { describe, expect, it } from 'vitest'

/**
 * Each `<variant>.config.json` under `fixtures/<slicer>/` describes one fixture:
 * - `gcode`: the input file name (defaults to `<variant>.gcode`), so several
 *   configs can share one sliced file;
 * - `config`: the tower config used for the transform;
 * - `expect.errors` / `expect.warnings`: the ADR-0004 codes the report must list.
 * `pnpm fixture` writes `<variant>.report.json` and, for valid inputs,
 * `<variant>.golden.gcode`; `pnpm test` checks them.
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
        const isBinary = isBinaryGcode(bytes, gcodeName)
        const text = isBinary ? '' : new TextDecoder().decode(bytes)
        const result = processGcode({ fileName: gcodeName, text, config: spec.config, isBinary })

        expect(result.report.errors.map((issue) => issue.code).sort()).toEqual([...(spec.expect?.errors ?? [])].sort())
        expect(result.report.warnings.map((issue) => issue.code).sort()).toEqual([...(spec.expect?.warnings ?? [])].sort())

        await expect(JSON.stringify(result.report, null, 2)).toMatchFileSnapshot(join(dir, `${variant}.report.json`))

        const goldenPath = join(dir, `${variant}.golden.gcode`)
        if (result.output === null) {
          expect(result.report.canDownload).toBe(false)
          expect(existsSync(goldenPath), 'an error fixture produces no output file').toBe(false)
          return
        }
        expect(result.report.canDownload).toBe(true)
        expect(result.output.startsWith('; [temptower] ')).toBe(true)
        await expect(result.output).toMatchFileSnapshot(goldenPath)
      })
    }
  })
}
