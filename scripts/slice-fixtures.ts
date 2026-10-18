/**
 * Regenerates the PrusaSlicer fixtures under `fixtures/prusaslicer/`.
 *
 * Real fixtures: builds the tower STL with `@temptower/geometry`, slices it with
 * the PrusaSlicer CLI (`PRUSA_SLICER` env var or the default app path) for each
 * profile variant, and writes `<variant>.gcode` plus `<variant>.config.json`.
 * Synthetic fixtures: small hand-shaped files for checks a plain slice cannot
 * trigger (no extrusion, variable layer height, unreadable binary, multi-tool,
 * marker mismatch). The Core One variant is sliced as text with the stock
 * binary-G-code profile and converted to `.bgcode` by `bgcode-from-text.ts`,
 * because the 3.0 CLI cannot export binary (LRN-002). Golden outputs and
 * report snapshots come from `pnpm fixture`.
 *
 * Usage: `pnpm slice-fixtures` (needs PrusaSlicer installed; see AGENTS.md).
 * `--only <name>` re-slices one variant; `--synthetic-only` skips the slicer.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Material, decodeBgcode, encodeTowerConfigName, type TowerConfig } from '../packages/core/src/index.ts'
import { buildTower, loadManifold, writeBinaryStl } from '../packages/geometry/src/index.ts'
import { bgcodeFromText, solidQoiThumbnail } from './bgcode-from-text.ts'

const SLICER = process.env.PRUSA_SLICER ?? '/Applications/PrusaSlicer-3.0.0-alpha12.app/Contents/MacOS/PrusaSlicer'

/** Profile names as the 3.0 CLI resolves them; `--query-print-tool-filament-profiles` lists them per printer. */
interface Profiles {
  readonly printer: string
  readonly filament: string
  readonly print: Readonly<Record<string, string>>
}
const MK3S: Profiles = {
  printer: 'Prusa MK3S 0.4',
  filament: 'Generic PLA@MK2.5_MK3 0.4',
  print: { '0.20': '0.20mm QUALITY @MK3 0.4', '0.15': '0.15mm QUALITY @MK3 0.4' },
}
const CORE_ONE: Profiles = {
  printer: 'Prusa CORE One 0.4 HF',
  filament: 'Generic PLA@COREONE HF0.4@COREONE 0.4',
  print: { '0.20': '0.20mm SPEED @COREONE 0.4HF' },
}

const OUT_DIR = join(import.meta.dirname, '..', 'fixtures', 'prusaslicer')
const WORK_DIR = join(tmpdir(), 'temptower-fixtures')

/** Small tower so fixtures stay around 1 MB: 3 tiers of 6 mm on a 1 mm base = 19 mm. */
const FIXTURE_CONFIG: TowerConfig = {
  material: Material.PLA,
  startTemperature: 230,
  endTemperature: 220,
  step: 5,
  blockHeight: 6,
  baseHeight: 1,
  waitForTemperature: false,
}

interface Variant {
  readonly name: string
  readonly profiles?: Profiles
  readonly layer: '0.20' | '0.15'
  readonly zhop?: number
  readonly relativeE: boolean
  readonly arcs?: boolean
  readonly duplicate?: number
  readonly completeObjects?: boolean
  /** Keep this thumbnail spec (e.g. `16x16/QOI`) and convert the slice to `.bgcode`. */
  readonly binary?: string
  readonly expect?: { errors?: string[]; warnings?: string[] }
  readonly notes?: string
}

const variants: readonly Variant[] = [
  ...(['0.20', '0.15'] as const).flatMap((layer) =>
    [true, false].flatMap((zhop) =>
      [true, false].map(
        (relativeE): Variant => ({
          name: `zhop-${zhop ? 'on' : 'off'}_${relativeE ? 'rel' : 'abs'}-e_${layer}`,
          layer,
          zhop: zhop ? 0.4 : 0,
          relativeE,
          // 19 mm is not on the 0.15 grid after a 0.2 first layer, so the top lands within one layer.
          ...(layer === '0.15'
            ? {
                expect: { warnings: ['height-off-by-one-layer'] },
                notes: '19 mm is not a multiple of 0.15 mm after the 0.2 mm first layer, so the top layer lands within one layer of the expected height.',
              }
            : {}),
        }),
      ),
    ),
  ),
  { name: 'arc-moves', layer: '0.20', zhop: 0.4, relativeE: true, arcs: true, notes: 'Arc fitting on, as PrusaSlicer 2.9.6 Core One and all 3.0 stock profiles have it; arcs are ordinary moves since ADR-0008.' },
  { name: 'multiple-objects', layer: '0.20', zhop: 0.4, relativeE: true, duplicate: 2, expect: { errors: ['multiple-objects'] } },
  { name: 'sequential-printing', layer: '0.20', zhop: 0.4, relativeE: true, duplicate: 2, completeObjects: true, expect: { errors: ['multiple-objects'] } },
  {
    name: 'coreone-binary',
    profiles: CORE_ONE,
    layer: '0.20',
    relativeE: true,
    binary: '16x16/QOI',
    notes: 'Stock Core One profile (binary G-code on, ramping lift), arc fitting off, converted to .bgcode by scripts/bgcode-from-text.ts with a stand-in 16x16 QOI thumbnail, because the headless CLI renders none (ADR-0007, LRN-002).',
  },
]

type Json = Record<string, unknown>

const run = (args: readonly string[]): void => {
  const result = spawnSync(SLICER, args, { encoding: 'utf8' })
  const noise = (line: string) => line.length === 0 || line.includes('[info]') || line.includes('BedGeometry') || line.includes('stlinit') || line.includes('PhysicalPrinterStorage')
  const failure = `${result.stdout}\n${result.stderr}`.split('\n').find((line) => !noise(line) && !line.startsWith('Slicing result exported'))
  if (result.status !== 0 || failure) throw new Error(`PrusaSlicer refused ${args.join(' ')}: ${failure ?? `exit ${result.status}`}`)
}

const saveBaseConfig = (profiles: Profiles, layer: Variant['layer']): Json => {
  const printProfile = profiles.print[layer]
  if (printProfile === undefined) throw new Error(`No ${layer} print profile for ${profiles.printer}`)
  const path = join(WORK_DIR, `base-${profiles.printer.replaceAll(/[^a-z0-9]+/gi, '_')}-${layer}.json`)
  if (!existsSync(path)) {
    run(['--printer-profile', profiles.printer, '--print-profile', printProfile, '--material-profile', profiles.filament, '--save', path])
  }
  return JSON.parse(readFileSync(path, 'utf8')) as Json
}

/** Sets `key` in whichever configuration section already holds it (sections moved between 2.x and 3.0). */
const patch = (config: Json, key: string, value: unknown): void => {
  const sections = config.configuration as Record<string, Json>
  const section = Object.values(sections).find((candidate) => key in candidate)
  if (!section) throw new Error(`Config key not found in any section: ${key}`)
  section[key] = value
}

const sliceVariant = (variant: Variant, stlPath: string): void => {
  const config = saveBaseConfig(variant.profiles ?? MK3S, variant.layer)
  patch(config, 'arc_fitting', variant.arcs ? 'emit_center' : 'disabled')
  if (variant.zhop !== undefined) patch(config, 'retract_lift', variant.zhop)
  patch(config, 'use_relative_e_distances', variant.relativeE)
  if (!variant.relativeE) {
    // PrusaSlicer refuses `G92 E0` in custom G-code under absolute E, and the
    // Prusa start G-code switches to M83; mirror what a user with absolute E has.
    const sections = config.configuration as Record<string, Record<string, string>>
    const printer = sections.printer_settings!
    printer.before_layer_gcode = printer.before_layer_gcode!.replace(/G92 E0(\.0)?\n/g, '')
    printer.start_gcode = printer.start_gcode!.replace('M83 ; extruder relative mode', 'M82 ; extruder absolute mode')
  }
  patch(config, 'complete_objects', variant.completeObjects ?? false)
  patch(config, 'thumbnails', variant.binary ?? '')
  const configPath = join(WORK_DIR, `${variant.name}.json`)
  writeFileSync(configPath, JSON.stringify(config))

  const textPath = variant.binary ? join(WORK_DIR, `${variant.name}.gcode`) : join(OUT_DIR, `${variant.name}.gcode`)
  rmSync(textPath, { force: true })
  run(['--load', configPath, '--export-gcode', stlPath, '--output', textPath, ...(variant.duplicate ? ['--duplicate', String(variant.duplicate)] : [])])
  const text = readFileSync(textPath, 'utf8')
  if (text.includes(process.env.HOME ?? '/nonexistent')) throw new Error(`${variant.name}: output embeds a home path`)

  let inputName = `${variant.name}.gcode`
  let size = text.length
  if (variant.binary) {
    // The CLI writes text even with binary_gcode on, and renders no thumbnail (LRN-002); binarize it
    // the way the GUI export would, with a stand-in thumbnail so the byte-for-byte copy is exercised.
    const bytes = bgcodeFromText(text, { fallbackThumbnails: [solidQoiThumbnail(16, 16, [0xff, 0x80, 0x00])] })
    const decoded = decodeBgcode(bytes)
    if (decoded.summary.thumbnails === 0) throw new Error(`${variant.name}: no thumbnail in the converted file`)
    inputName = `${variant.name}.bgcode`
    writeFileSync(join(OUT_DIR, inputName), bytes)
    size = bytes.length
  }

  writeFileSync(
    join(OUT_DIR, `${variant.name}.config.json`),
    `${JSON.stringify({ ...(variant.binary ? { gcode: inputName } : {}), config: FIXTURE_CONFIG, ...(variant.expect ? { expect: variant.expect } : {}), ...(variant.notes ? { notes: variant.notes } : {}) }, null, 2)}\n`,
  )
  console.log(`sliced ${variant.name} (${Math.round(size / 1024)} KB)`)
}

/** A minimal tower-shaped file: start G-code, one square per layer, end G-code. */
const syntheticTower = (options: { top?: number; layerHeight?: number; heights?: number[]; extra?: (z: number) => string[] }): string => {
  const lines = ['; generated by PrusaSlicer 2.8.1 on 2026-01-01 at 00:00:00 UTC', '; synthetic fixture, see scripts/slice-fixtures.ts', 'M104 S215 ; set extruder temp', 'M109 S215 ; wait for extruder temp', 'G28 W', 'G90', 'M83', 'G92 E0']
  const zs: number[] = []
  if (options.heights) {
    let z = 0
    for (const height of options.heights) {
      z = Math.round((z + height) * 1000) / 1000
      zs.push(z)
    }
  } else {
    const h = options.layerHeight ?? 0.2
    for (let z = h; z <= (options.top ?? 0) + 0.0001; z = Math.round((z + h) * 1000) / 1000) zs.push(z)
  }
  for (const z of zs) {
    lines.push(';LAYER_CHANGE', `;Z:${z}`, `G1 Z${z} F720`, ...(options.extra?.(z) ?? []), 'G1 X100 Y100 F9000', 'G1 X120 Y100 E1 F1200', 'G1 X120 Y120 E1', 'G1 X100 Y120 E1', 'G1 X100 Y100 E1')
  }
  lines.push('M104 S0 ; turn off temperature', 'M140 S0', 'M84', '; temperature = 215', '; first_layer_temperature = 215', '; filament_type = PLA', '; layer_height = 0.2', '; printer_model = MK3S', '')
  return lines.join('\n')
}

const writeSynthetic = (name: string, content: string | Uint8Array, expect: { errors?: string[]; warnings?: string[] }, gcodeName = `${name}.gcode`, notes?: string): void => {
  writeFileSync(join(OUT_DIR, gcodeName), content)
  writeFileSync(
    join(OUT_DIR, `${name}.config.json`),
    `${JSON.stringify({ ...(gcodeName !== `${name}.gcode` ? { gcode: gcodeName } : {}), config: FIXTURE_CONFIG, expect, notes: notes ?? 'Synthetic fixture written by scripts/slice-fixtures.ts.' }, null, 2)}\n`,
  )
  console.log(`wrote ${name}`)
}

const writeDerived = (name: string, gcode: string, config: TowerConfig, expect: { errors?: string[]; warnings?: string[] }, notes: string): void => {
  writeFileSync(join(OUT_DIR, `${name}.config.json`), `${JSON.stringify({ gcode, config, expect, notes }, null, 2)}\n`)
  console.log(`wrote ${name}`)
}

const main = async (): Promise<void> => {
  const syntheticOnly = process.argv.includes('--synthetic-only')
  const onlyIndex = process.argv.indexOf('--only')
  const only = onlyIndex === -1 ? null : process.argv[onlyIndex + 1]
  if (only !== null && !variants.some((variant) => variant.name === only)) throw new Error(`Unknown variant ${only}; known: ${variants.map((v) => v.name).join(', ')}`)
  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(WORK_DIR, { recursive: true })

  if (!syntheticOnly) {
    if (!existsSync(SLICER)) throw new Error(`PrusaSlicer not found at ${SLICER}; set PRUSA_SLICER`)
    const wasm = await loadManifold()
    const tower = buildTower(wasm, FIXTURE_CONFIG)
    const stlPath = join(WORK_DIR, `${encodeTowerConfigName(FIXTURE_CONFIG)}.stl`)
    writeFileSync(stlPath, writeBinaryStl(tower.mesh))
    for (const variant of variants) {
      if (only === null || variant.name === only) sliceVariant(variant, stlPath)
    }
  }

  writeSynthetic('no-extrusion', syntheticTower({ top: 0 }), { errors: ['no-extrusion'] })
  // 0.2 + 40 alternating 0.3/0.1 layers + 54 × 0.2 = 19 mm, so only the layer height check fires.
  writeSynthetic('variable-layer-height', syntheticTower({ heights: [0.2, ...Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 0.3 : 0.1)), ...Array.from({ length: 54 }, () => 0.2)] }), { errors: ['variable-layer-height'] })
  // A GCDE magic with the header cut off: the decoder must refuse it with a reason (ADR-0007).
  writeSynthetic('binary-gcode-unreadable', new Uint8Array([0x47, 0x43, 0x44, 0x45, 0x01, 0x00, 0x00, 0x00]), { errors: ['binary-gcode-unreadable'] }, 'binary-gcode-unreadable.bgcode')
  writeSynthetic('multi-tool', syntheticTower({ top: 19, extra: (z) => (z === 0.2 ? ['T0'] : z === 7 ? ['T1', 'M104 S230 T1'] : []) }), { warnings: ['multi-tool'] })
  writeSynthetic('marker-mismatch', `${syntheticTower({ top: 19 })};LAYER_CHANGE\n;Z:40\n`, { warnings: ['marker-mismatch'] })

  writeDerived('height-mismatch', 'zhop-on_rel-e_0.20.gcode', { ...FIXTURE_CONFIG, blockHeight: 10 }, { errors: ['height-mismatch'] }, 'Same sliced file as zhop-on_rel-e_0.20 with a config that expects a 31 mm tower.')
  writeDerived('temperature-outside-preset', 'zhop-on_rel-e_0.20.gcode', { ...FIXTURE_CONFIG, startTemperature: 240, endTemperature: 230 }, { warnings: ['temperature-outside-preset'] }, 'Same sliced file as zhop-on_rel-e_0.20 with tiers above the PLA preset range.')
}

await main()
