import type { BgcodeSummary } from './bgcode/index.ts'
import { encodeTowerConfigName } from './filename-codec.ts'
import type { MotionAnalysis } from './motion.ts'
import { typicalLayerHeight } from './motion.ts'
import type { SlicerInfo } from './slicers/types.ts'
import { tierBoundaryZ, towerHeight, type TowerConfig } from './tower-config.ts'
import type { Change, TierPlacement } from './transform.ts'
import { hasErrors, Severity, type ValidationIssue } from './validation.ts'
import { TOOL_VERSION } from './version.ts'

export const BaseTemperatureSource = {
  SLICER_CONFIG: 'slicer-config',
  START_GCODE: 'start-gcode',
  UNKNOWN: 'unknown',
} as const
export type BaseTemperatureSource = (typeof BaseTemperatureSource)[keyof typeof BaseTemperatureSource]

export interface ChartPoint {
  readonly z: number
  readonly temperature: number | null
}

/** Whether the upload was plain text or binary G-code, and how the binary was encoded (ADR-0007). */
export interface ReportInput {
  readonly format: 'text' | 'binary'
  readonly binary: BgcodeSummary | null
}

export interface ReportLine {
  /** 1-based line number in the input file. */
  readonly lineNumber: number
  readonly text: string
}

export interface NeutralizedLine extends ReportLine {
  readonly original: string
}

/** Everything the user sees before download (ADR-0004). Serializable for snapshots. */
export interface Report {
  readonly toolVersion: string
  readonly fileName: string
  readonly slicer: { readonly name: string; readonly version: string | null }
  readonly input: ReportInput
  readonly baseTemperature: { readonly value: number | null; readonly source: BaseTemperatureSource }
  readonly config: TowerConfig
  readonly configName: string
  readonly layers: {
    readonly count: number
    readonly typicalHeight: number
    readonly maxZ: number
    readonly expectedHeight: number
  }
  readonly errors: readonly ValidationIssue[]
  readonly warnings: readonly ValidationIssue[]
  readonly tiers: readonly TierPlacement[]
  readonly inserted: readonly ReportLine[]
  readonly neutralized: readonly NeutralizedLine[]
  readonly chart: readonly ChartPoint[]
  readonly canDownload: boolean
}

export interface BuildReportInput {
  readonly fileName: string
  readonly slicer: SlicerInfo
  readonly motion: MotionAnalysis
  readonly config: TowerConfig
  readonly issues: readonly ValidationIssue[]
  readonly tiers: readonly TierPlacement[]
  readonly changes: readonly Change[]
  readonly input: ReportInput
}

const baseTemperature = (slicer: SlicerInfo, motion: MotionAnalysis): Report['baseTemperature'] => {
  if (slicer.temperature !== null) return { value: slicer.temperature, source: BaseTemperatureSource.SLICER_CONFIG }
  const first = motion.temperatureLines.find((line) => line.target !== null && line.target > 0)
  if (first) return { value: first.target, source: BaseTemperatureSource.START_GCODE }
  return { value: null, source: BaseTemperatureSource.UNKNOWN }
}

/** Step series: base temperature up to the first tier, then one step per tier. */
export const buildChart = (config: TowerConfig, base: number | null, tiers: readonly TierPlacement[]): readonly ChartPoint[] => {
  const points: ChartPoint[] = [{ z: 0, temperature: base }]
  for (const tier of tiers) points.push({ z: tier.boundaryZ, temperature: tier.temperature })
  points.push({ z: towerHeight(config), temperature: tiers.at(-1)?.temperature ?? base })
  return points
}

export const buildReport = ({ fileName, slicer, motion, config, issues, tiers, changes, input }: BuildReportInput): Report => {
  const errors = issues.filter((issue) => issue.severity === Severity.ERROR)
  const warnings = issues.filter((issue) => issue.severity === Severity.WARNING)
  const base = baseTemperature(slicer, motion)
  return {
    toolVersion: TOOL_VERSION,
    fileName,
    slicer: { name: slicer.slicer, version: slicer.version },
    input,
    baseTemperature: base,
    config,
    configName: encodeTowerConfigName(config),
    layers: {
      count: motion.layers.length,
      typicalHeight: typicalLayerHeight(motion.layers),
      maxZ: motion.maxLayerZ,
      expectedHeight: towerHeight(config),
    },
    errors,
    warnings,
    tiers,
    inserted: changes.flatMap((change) => (change.kind === 'insert' ? [{ lineNumber: change.lineIndex + 1, text: change.text }] : [])),
    neutralized: changes.flatMap((change) =>
      change.kind === 'neutralize' ? [{ lineNumber: change.lineIndex + 1, text: change.text, original: change.original }] : [],
    ),
    chart: buildChart(config, base.value, tiers),
    canDownload: !hasErrors(issues),
  }
}

export const firstTierBoundary = (config: TowerConfig): number => tierBoundaryZ(config, 0)
