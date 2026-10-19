import type { MotionAnalysis } from './motion.ts'
import type { SlicerInfo } from './slicers/types.ts'

export const ProfileTemperatureSource = {
  SLICER_CONFIG: 'slicer-config',
  START_GCODE: 'start-gcode',
  UNKNOWN: 'unknown',
} as const
export type ProfileTemperatureSource = (typeof ProfileTemperatureSource)[keyof typeof ProfileTemperatureSource]

export interface ProfileTemperature {
  readonly value: number | null
  readonly source: ProfileTemperatureSource
}

/** The profile's first-layer nozzle temperature, which the tier 0 command replaces (ADR-0009). */
export const profileTemperature = (slicer: SlicerInfo, motion: MotionAnalysis): ProfileTemperature => {
  const configured = slicer.firstLayerTemperature ?? slicer.temperature
  if (configured !== null) return { value: configured, source: ProfileTemperatureSource.SLICER_CONFIG }
  const first = motion.temperatureLines.find((line) => line.target !== null && line.target > 0)
  if (first) return { value: first.target, source: ProfileTemperatureSource.START_GCODE }
  return { value: null, source: ProfileTemperatureSource.UNKNOWN }
}
