import { encodeTowerConfigName } from './filename-codec.ts'
import type { GcodeLine } from './gcode-lines.ts'
import type { Layer, MotionAnalysis } from './motion.ts'
import { tierCount, tierStartZ, tierTemperature, Z_EPSILON, type TowerConfig } from './tower-config.ts'
import { MARKER, TOOL_NAME, TOOL_VERSION } from './version.ts'

export interface TierPlacement {
  readonly tier: number
  readonly temperature: number
  /** Z from which the tier's temperature applies: 0 for tier 0 (ADR-0009). */
  readonly startZ: number
  readonly layerIndex: number | null
  readonly layerZ: number | null
  /** Input line the tier command is inserted before, or null when no layer reaches the tier start. */
  readonly lineIndex: number | null
}

export type Change =
  | { readonly kind: 'header'; readonly text: string }
  | { readonly kind: 'insert'; readonly lineIndex: number; readonly tier: number; readonly text: string }
  | { readonly kind: 'neutralize'; readonly lineIndex: number; readonly original: string; readonly text: string }

export interface TransformResult {
  readonly text: string
  readonly changes: readonly Change[]
  readonly tiers: readonly TierPlacement[]
}

/**
 * Maps each tier to the first layer that prints above its start. A layer's Z is
 * its top, so a layer topped exactly at the start still belongs to the tier below
 * (ADR-0010). Tier 0 starts at Z 0, so it lands on layer 0, whose first extruding
 * move is the start G-code's purge line in PrusaSlicer's stock profiles (ADR-0009).
 * Shared formula from tower-config (ADR-0005).
 */
export const planTiers = (config: TowerConfig, layers: readonly Layer[]): readonly TierPlacement[] => {
  const placements: TierPlacement[] = []
  let searchFrom = 0
  for (let tier = 0; tier < tierCount(config); tier += 1) {
    const startZ = tierStartZ(config, tier)
    let found: Layer | null = null
    for (let i = searchFrom; i < layers.length; i += 1) {
      const layer = layers[i]!
      if (layer.z > startZ + Z_EPSILON) {
        found = layer
        searchFrom = i + 1
        break
      }
    }
    placements.push({
      tier,
      temperature: tierTemperature(config, tier),
      startZ,
      layerIndex: found?.index ?? null,
      layerZ: found?.z ?? null,
      lineIndex: found?.firstLineIndex ?? null,
    })
  }
  return placements
}

/**
 * Where the tier marker goes: `inline` as a trailing comment (plain G-code), or
 * `line` as its own comment line before a bare command, because MeatPack drops
 * inline comments from binary G-code (ADR-0007).
 */
export type MarkerStyle = 'inline' | 'line'

export const tierMarkerLine = (tier: number): string => `${MARKER} tier ${tier}`

/** Tier 0 always waits, or layer 0 would print while the nozzle heats from the profile's temperature (ADR-0009). */
const isWaitingTier = (config: TowerConfig, tier: number): boolean => tier === 0 || config.waitForTemperature

export const tierCommand = (config: TowerConfig, tier: number, markerStyle: MarkerStyle = 'inline'): string => {
  // R waits for cooling as well as heating; M109 S returns at once when the nozzle is hotter (ADR-0010).
  const command = isWaitingTier(config, tier) ? `M109 R${tierTemperature(config, tier)}` : `M104 S${tierTemperature(config, tier)}`
  return markerStyle === 'inline' ? `${command} ${tierMarkerLine(tier)}` : command
}

export const NEUTRALIZED_PREFIX = `${MARKER} neutralized: `

const buildHeader = (config: TowerConfig, insertedCount: number, neutralizedCount: number): readonly string[] => {
  const n = tierCount(config)
  const first = tierTemperature(config, 0)
  const last = tierTemperature(config, n - 1)
  return [
    `${MARKER} ${TOOL_NAME} v${TOOL_VERSION}`,
    `${MARKER} config: ${encodeTowerConfigName(config)}`,
    `${MARKER} tiers: ${n} x ${config.blockHeight} mm on a ${config.baseHeight} mm base (${first} to ${last} C, step ${config.step}, tier 0 M109 wait, tiers 1+ ${config.waitForTemperature ? 'M109 wait' : 'M104 no wait'})`,
    `${MARKER} changes: ${insertedCount} tier commands inserted, ${neutralizedCount} temperature commands neutralized, start G-code kept`,
  ]
}

export interface TransformInput {
  readonly lines: readonly GcodeLine[]
  readonly motion: MotionAnalysis
  readonly config: TowerConfig
  readonly markerStyle?: MarkerStyle
}

/**
 * Pure line-preserving transform (ADR-0002): every output line is an input line
 * byte-for-byte, an inserted tier command, a header line, or a neutralized line.
 */
export const transformGcode = ({ lines, motion, config, markerStyle = 'inline' }: TransformInput): TransformResult => {
  const tiers = planTiers(config, motion.layers)
  const insertBefore = new Map<number, TierPlacement[]>()
  for (const placement of tiers) {
    if (placement.lineIndex === null) continue
    const list = insertBefore.get(placement.lineIndex) ?? []
    list.push(placement)
    insertBefore.set(placement.lineIndex, list)
  }

  // Everything after the tier 0 command is the tower's; the start G-code before it is kept (ADR-0009).
  const tierZeroLine = tiers[0]?.lineIndex ?? null
  const neutralize = new Set<number>()
  for (const temperatureLine of motion.temperatureLines) {
    const isTurnOff = temperatureLine.target !== null && temperatureLine.target <= 0
    if (!isTurnOff && tierZeroLine !== null && temperatureLine.lineIndex > tierZeroLine) neutralize.add(temperatureLine.lineIndex)
  }

  const ending = lines.find((line) => line.ending !== '')?.ending ?? '\n'
  const changes: Change[] = []
  const output: string[] = []

  for (const headerLine of buildHeader(config, insertBefore.size === 0 ? 0 : tiers.filter((t) => t.lineIndex !== null).length, neutralize.size)) {
    changes.push({ kind: 'header', text: headerLine })
    output.push(headerLine, ending)
  }

  for (const line of lines) {
    const inserts = insertBefore.get(line.index)
    if (inserts) {
      for (const placement of inserts) {
        const inserted = markerStyle === 'inline' ? [tierCommand(config, placement.tier)] : [tierMarkerLine(placement.tier), tierCommand(config, placement.tier, 'line')]
        for (const text of inserted) {
          changes.push({ kind: 'insert', lineIndex: line.index, tier: placement.tier, text })
          output.push(text, ending)
        }
      }
    }
    if (neutralize.has(line.index)) {
      const text = `${NEUTRALIZED_PREFIX}${line.raw}`
      changes.push({ kind: 'neutralize', lineIndex: line.index, original: line.raw, text })
      output.push(text, line.ending)
      continue
    }
    output.push(line.raw, line.ending)
  }

  return { text: output.join(''), changes, tiers }
}
