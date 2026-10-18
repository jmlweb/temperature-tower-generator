import type { GcodeLine } from '../gcode-lines.ts'

export interface LayerMarker {
  readonly lineIndex: number
  readonly z: number
}

/**
 * What a slicer adapter recovers from comments. Everything here is optional
 * input for defaults and cross-checks; motion state decides layers (ADR-0003).
 */
export interface SlicerInfo {
  readonly slicer: string
  readonly version: string | null
  /** Nozzle temperature from the slicer's config block, if present. */
  readonly temperature: number | null
  readonly firstLayerTemperature: number | null
  readonly filamentType: string | null
  readonly layerHeight: number | null
  readonly firstLayerHeight: number | null
  readonly completeObjects: boolean | null
  readonly printerModel: string | null
  readonly objectNames: readonly string[]
  readonly layerMarkers: readonly LayerMarker[]
  readonly config: Readonly<Record<string, string>>
}

export interface SlicerReader {
  readonly name: string
  detect(lines: readonly GcodeLine[]): boolean
  read(lines: readonly GcodeLine[]): SlicerInfo
}
