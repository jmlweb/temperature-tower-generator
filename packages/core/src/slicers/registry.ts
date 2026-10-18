import type { GcodeLine } from '../gcode-lines.ts'
import { prusaSlicerReader } from './prusaslicer.ts'
import type { SlicerInfo, SlicerMetadata, SlicerReader } from './types.ts'

/** Phase 1 holds only the PrusaSlicer reader (ADR-0003). */
export const slicerReaders: readonly SlicerReader[] = [prusaSlicerReader]

export const UNKNOWN_SLICER: SlicerInfo = {
  slicer: 'unknown',
  version: null,
  temperature: null,
  firstLayerTemperature: null,
  filamentType: null,
  layerHeight: null,
  firstLayerHeight: null,
  completeObjects: null,
  printerModel: null,
  objectNames: [],
  layerMarkers: [],
  config: {},
}

export const readSlicerInfo = (lines: readonly GcodeLine[], metadata: SlicerMetadata = null): SlicerInfo => {
  const reader = slicerReaders.find((candidate) => candidate.detect(lines, metadata))
  return reader ? reader.read(lines, metadata) : UNKNOWN_SLICER
}
