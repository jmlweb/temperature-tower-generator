import { TowerConfigError } from './errors.ts'
import { parseGcode } from './gcode-lines.ts'
import { analyzeMotion } from './motion.ts'
import { recoverTowerConfig, type RecoveredConfig } from './recover-config.ts'
import { buildReport, type Report } from './report.ts'
import { readSlicerInfo } from './slicers/registry.ts'
import type { SlicerInfo } from './slicers/types.ts'
import { validateTowerConfig, type TowerConfig } from './tower-config.ts'
import { transformGcode } from './transform.ts'
import { hasErrors, validateGcode } from './validation.ts'

export interface InspectInput {
  readonly fileName: string
  readonly text: string
}

export interface Inspection {
  readonly slicer: SlicerInfo
  readonly recovered: RecoveredConfig | null
}

/** First pass after upload: who sliced it and whether the config can be recovered. */
export const inspectGcode = ({ fileName, text }: InspectInput): Inspection => {
  const lines = parseGcode(text)
  const slicer = readSlicerInfo(lines)
  return { slicer, recovered: recoverTowerConfig(fileName, slicer.objectNames) }
}

export interface ProcessInput {
  readonly fileName: string
  readonly text: string
  readonly config: TowerConfig
  readonly isBinary?: boolean
}

export interface ProcessResult {
  readonly report: Report
  /** Transformed G-code, or null when an error blocks the download (ADR-0004). */
  readonly output: string | null
  readonly outputFileName: string
}

export const outputFileName = (fileName: string): string => {
  const base = fileName.replace(/\.(gcode|g|gco|bgcode)$/i, '')
  return `${base}_temptower.gcode`
}

export const processGcode = ({ fileName, text, config, isBinary = false }: ProcessInput): ProcessResult => {
  const problems = validateTowerConfig(config)
  if (problems.length > 0) throw new TowerConfigError(problems)

  const lines = parseGcode(isBinary ? '' : text)
  const slicer = readSlicerInfo(lines)
  const motion = analyzeMotion(lines)
  const issues = validateGcode({ motion, slicer, config, isBinary })
  const blocked = hasErrors(issues)
  const transformed = blocked ? null : transformGcode({ lines, motion, config })
  const report = buildReport({
    fileName,
    slicer,
    motion,
    config,
    issues,
    tiers: transformed?.tiers ?? [],
    changes: transformed?.changes ?? [],
  })
  return { report, output: transformed?.text ?? null, outputFileName: outputFileName(fileName) }
}
