import { encodeBgcode, utf8Encode } from './bgcode/index.ts'
import { TowerConfigError } from './errors.ts'
import type { LoadedGcode } from './gcode-file.ts'
import { parseGcode } from './gcode-lines.ts'
import { analyzeMotion } from './motion.ts'
import { recoverTowerConfig, type RecoveredConfig } from './recover-config.ts'
import { buildReport, type Report } from './report.ts'
import { readSlicerInfo } from './slicers/registry.ts'
import type { SlicerInfo } from './slicers/types.ts'
import { validateTowerConfig, type TowerConfig } from './tower-config.ts'
import { transformGcode } from './transform.ts'
import { hasErrors, validateGcode } from './validation.ts'

export interface Inspection {
  readonly slicer: SlicerInfo
  readonly recovered: RecoveredConfig | null
}

/** First pass after upload: who sliced it and whether the config can be recovered. */
export const inspectGcode = (file: LoadedGcode): Inspection => {
  const lines = parseGcode(file.text)
  const slicer = readSlicerInfo(lines, file.binary?.metadata ?? null)
  return { slicer, recovered: recoverTowerConfig(file.fileName, slicer.objectNames) }
}

export interface ProcessInput {
  readonly file: LoadedGcode
  readonly config: TowerConfig
}

export interface ProcessResult {
  readonly report: Report
  /** Transformed G-code text (the decoded form for binary input), or null when an error blocks the download (ADR-0004). */
  readonly output: string | null
  /** Bytes to download: UTF-8 text, or a re-encoded `.bgcode` for binary input (ADR-0007). */
  readonly outputBytes: Uint8Array | null
  readonly outputFileName: string
}

export const outputFileName = (fileName: string, binary = false): string => {
  const base = fileName.replace(/\.(gcode|g|gco|bgcode)$/i, '')
  return `${base}_temptower.${binary ? 'bgcode' : 'gcode'}`
}

export const processGcode = ({ file, config }: ProcessInput): ProcessResult => {
  const problems = validateTowerConfig(config)
  if (problems.length > 0) throw new TowerConfigError(problems)

  const lines = parseGcode(file.text)
  const slicer = readSlicerInfo(lines, file.binary?.metadata ?? null)
  const motion = analyzeMotion(lines)
  const issues = validateGcode({ motion, slicer, config, binaryError: file.binaryError })
  const blocked = hasErrors(issues)
  // MeatPack drops inline comments, so binary output carries the tier marker on its own line (ADR-0007).
  const transformed = blocked ? null : transformGcode({ lines, motion, config, markerStyle: file.binary ? 'line' : 'inline' })
  const report = buildReport({
    fileName: file.fileName,
    slicer,
    motion,
    config,
    issues,
    tiers: transformed?.tiers ?? [],
    changes: transformed?.changes ?? [],
    input: { format: file.binary || file.binaryError !== null ? 'binary' : 'text', binary: file.binary?.summary ?? null },
  })
  const output = transformed?.text ?? null
  const outputBytes = output === null ? null : file.binary ? encodeBgcode(file.binary, output) : utf8Encode(output)
  return { report, output, outputBytes, outputFileName: outputFileName(file.fileName, file.binary !== null) }
}
