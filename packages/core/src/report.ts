import type { BgcodeSummary } from './bgcode/index.ts'
import { encodeTowerConfigName } from './filename-codec.ts'
import type { MotionAnalysis } from './motion.ts'
import { typicalLayerHeight } from './motion.ts'
import { profileTemperature, type ProfileTemperature } from './profile-temperature.ts'
import type { SlicerInfo } from './slicers/types.ts'
import { towerHeight, type TowerConfig } from './tower-config.ts'
import type { Change, TierPlacement } from './transform.ts'
import { hasErrors, Severity, type ValidationIssue } from './validation.ts'
import { TOOL_VERSION } from './version.ts'

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
  /** The profile's first-layer temperature that tier 0 replaces (ADR-0009). */
  readonly profileTemperature: ProfileTemperature
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

/** Step series: one step per tier from its start, tier 0 from Z 0 (ADR-0009). */
export const buildChart = (config: TowerConfig, tiers: readonly TierPlacement[]): readonly ChartPoint[] => {
  const points: ChartPoint[] = tiers.map((tier) => ({ z: tier.startZ, temperature: tier.temperature }))
  points.push({ z: towerHeight(config), temperature: tiers.at(-1)?.temperature ?? null })
  return points
}

export const buildReport = ({ fileName, slicer, motion, config, issues, tiers, changes, input }: BuildReportInput): Report => {
  const errors = issues.filter((issue) => issue.severity === Severity.ERROR)
  const warnings = issues.filter((issue) => issue.severity === Severity.WARNING)
  return {
    toolVersion: TOOL_VERSION,
    fileName,
    slicer: { name: slicer.slicer, version: slicer.version },
    input,
    profileTemperature: profileTemperature(slicer, motion),
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
    chart: buildChart(config, tiers),
    canDownload: !hasErrors(issues),
  }
}
