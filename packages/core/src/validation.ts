import type { MotionAnalysis } from './motion.ts'
import { typicalLayerHeight } from './motion.ts'
import type { SlicerInfo } from './slicers/types.ts'
import { findPreset, Material, tierTemperatures, towerHeight, Z_EPSILON, type TowerConfig } from './tower-config.ts'

/** Every check is in the `error` or `warning` list of ADR-0004. */
export const ValidationCode = {
  NO_EXTRUSION: 'no-extrusion',
  VARIABLE_LAYER_HEIGHT: 'variable-layer-height',
  MULTIPLE_OBJECTS: 'multiple-objects',
  BINARY_GCODE: 'binary-gcode',
  ARC_MOVES: 'arc-moves',
  HEIGHT_MISMATCH: 'height-mismatch',
  HEIGHT_OFF_BY_ONE_LAYER: 'height-off-by-one-layer',
  TEMPERATURE_OUTSIDE_PRESET: 'temperature-outside-preset',
  MARKER_MISMATCH: 'marker-mismatch',
  MULTI_TOOL: 'multi-tool',
} as const
export type ValidationCode = (typeof ValidationCode)[keyof typeof ValidationCode]

export const Severity = { ERROR: 'error', WARNING: 'warning' } as const
export type Severity = (typeof Severity)[keyof typeof Severity]

export interface ValidationIssue {
  readonly severity: Severity
  readonly code: ValidationCode
  readonly message: string
}

export interface ValidationInput {
  readonly motion: MotionAnalysis
  readonly slicer: SlicerInfo
  readonly config: TowerConfig
  readonly isBinary: boolean
}

const LAYER_HEIGHT_TOLERANCE = 0.0015
const error = (code: ValidationCode, message: string): ValidationIssue => ({ severity: Severity.ERROR, code, message })
const warning = (code: ValidationCode, message: string): ValidationIssue => ({ severity: Severity.WARNING, code, message })

const formatZ = (z: number): string => z.toFixed(2)

export const validateGcode = ({ motion, slicer, config, isBinary }: ValidationInput): readonly ValidationIssue[] => {
  if (isBinary) {
    return [error(ValidationCode.BINARY_GCODE, 'Binary G-code (.bgcode) is not supported. Export ASCII G-code from PrusaSlicer (Printer Settings > General > Supports binary G-code: off).')]
  }
  const issues: ValidationIssue[] = []
  const { layers } = motion

  if (!motion.hasExtrusion || layers.length === 0) {
    issues.push(error(ValidationCode.NO_EXTRUSION, 'No extruding moves found, so no layers could be detected.'))
    return issues
  }

  if (motion.arcLineIndexes.length > 0) {
    const first = motion.arcLineIndexes[0]! + 1
    issues.push(error(ValidationCode.ARC_MOVES, `Arc moves (G2/G3) are not supported yet; the first one is on line ${first}. Set Print Settings > Advanced > Arc fitting to Disabled and re-slice.`))
  }

  const heights = layers.slice(1).filter((layer) => !layer.descending).map((layer) => layer.height)
  const typical = typicalLayerHeight(layers)
  const uneven = heights.filter((height) => Math.abs(height - typical) > LAYER_HEIGHT_TOLERANCE)
  if (uneven.length > 0) {
    issues.push(error(ValidationCode.VARIABLE_LAYER_HEIGHT, `Layer height varies (${uneven.length} layers differ from ${typical} mm). Variable layer height is not supported.`))
  }

  const descending = layers.filter((layer) => layer.index > 1 && layer.descending)
  const objectCount = slicer.objectNames.length
  if (slicer.completeObjects === true || objectCount > 1 || descending.length > 0) {
    issues.push(error(ValidationCode.MULTIPLE_OBJECTS, objectCount > 1
      ? `The file contains ${objectCount} objects (${slicer.objectNames.join(', ')}). Slice the tower alone.`
      : 'The file prints objects sequentially. Slice the tower alone with sequential printing off.'))
  }

  const expected = towerHeight(config)
  const actual = motion.maxLayerZ
  const difference = Math.abs(actual - expected)
  if (difference > typical + Z_EPSILON) {
    issues.push(error(ValidationCode.HEIGHT_MISMATCH, `The model is ${formatZ(actual)} mm tall but the tower config expects ${formatZ(expected)} mm. Check the config or re-slice the matching STL without Z scaling.`))
  } else if (difference > Z_EPSILON) {
    issues.push(warning(ValidationCode.HEIGHT_OFF_BY_ONE_LAYER, `The model is ${formatZ(actual)} mm tall, within one layer of the expected ${formatZ(expected)} mm.`))
  }

  if (config.material !== Material.CUSTOM) {
    const preset = findPreset(config.material)
    const outside = tierTemperatures(config).filter((t) => t < preset.minTemperature || t > preset.maxTemperature)
    if (outside.length > 0) {
      issues.push(warning(ValidationCode.TEMPERATURE_OUTSIDE_PRESET, `Tier temperatures ${outside.join(', ')} °C are outside the ${preset.label} range ${preset.minTemperature}–${preset.maxTemperature} °C.`))
    }
  }

  if (slicer.layerMarkers.length > 0) {
    const markerZs = slicer.layerMarkers.map((marker) => marker.z)
    const layerZs = layers.map((layer) => layer.z)
    const sameCount = markerZs.length === layerZs.length
    const sameZs = sameCount && markerZs.every((z, i) => Math.abs(z - layerZs[i]!) <= Z_EPSILON)
    if (!sameZs) {
      issues.push(warning(ValidationCode.MARKER_MISMATCH, `Slicer layer markers (${markerZs.length}) disagree with the ${layerZs.length} layers detected from motion. Motion wins; check the chart.`))
    }
  }

  if (motion.toolsUsed.length > 1) {
    issues.push(warning(ValidationCode.MULTI_TOOL, `Multi-tool G-code (tools ${motion.toolsUsed.join(', ')}): only the active tool's temperature is changed.`))
  }

  return issues
}

export const hasErrors = (issues: readonly ValidationIssue[]): boolean => issues.some((issue) => issue.severity === Severity.ERROR)
