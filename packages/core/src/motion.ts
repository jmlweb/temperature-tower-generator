import type { GcodeLine } from './gcode-lines.ts'
import { Z_EPSILON } from './tower-config.ts'

/**
 * A layer is the first extruding move above the current layer Z (ADR-0003).
 * `firstLineIndex` is the line of that move; a tier command is inserted before it.
 */
export interface Layer {
  readonly index: number
  readonly z: number
  readonly height: number
  readonly firstLineIndex: number
  /** True when this layer's Z is below the previous layer's (sequential printing). */
  readonly descending: boolean
}

export interface TemperatureLine {
  readonly lineIndex: number
  readonly code: 'M104' | 'M109'
  readonly target: number | null
  readonly tool: number | null
  /** Z of the layer being printed when the line runs; -Infinity before the first layer. */
  readonly layerZ: number
}

export interface MotionAnalysis {
  readonly layers: readonly Layer[]
  readonly hasExtrusion: boolean
  readonly maxLayerZ: number
  readonly arcLineIndexes: readonly number[]
  readonly toolsUsed: readonly number[]
  readonly temperatureLines: readonly TemperatureLine[]
  /** Layer Z in effect at each line, -Infinity before the first layer. */
  readonly lineLayerZ: Float64Array
}

const isCloseTo = (a: number, b: number): boolean => Math.abs(a - b) <= Z_EPSILON

export const analyzeMotion = (lines: readonly GcodeLine[]): MotionAnalysis => {
  let absolutePositioning = true
  let absoluteExtrusion = true
  let x = 0
  let y = 0
  let z = 0
  let e = 0
  let currentLayerZ = Number.NEGATIVE_INFINITY
  let hasExtrusion = false
  const layers: Layer[] = []
  const arcLineIndexes: number[] = []
  const toolsUsed = new Set<number>()
  const temperatureLines: TemperatureLine[] = []
  const lineLayerZ = new Float64Array(lines.length)

  const applyMove = (line: GcodeLine): void => {
    const { words } = line
    const nextX = words.X === undefined ? x : absolutePositioning ? words.X : x + words.X
    const nextY = words.Y === undefined ? y : absolutePositioning ? words.Y : y + words.Y
    const nextZ = words.Z === undefined ? z : absolutePositioning ? words.Z : z + words.Z
    const deltaE = words.E === undefined ? 0 : absoluteExtrusion ? words.E - e : words.E
    const nextE = words.E === undefined ? e : absoluteExtrusion ? words.E : e + words.E
    const movesXY = nextX !== x || nextY !== y
    if (deltaE > 0 && movesXY) {
      hasExtrusion = true
      if (!isCloseTo(nextZ, currentLayerZ)) {
        const previous = layers.at(-1)
        layers.push({
          index: layers.length,
          z: nextZ,
          height: previous ? Math.round((nextZ - previous.z) * 1000) / 1000 : nextZ,
          firstLineIndex: line.index,
          descending: previous !== undefined && nextZ < previous.z,
        })
        currentLayerZ = nextZ
      }
    }
    x = nextX
    y = nextY
    z = nextZ
    e = nextE
  }

  for (const line of lines) {
    switch (line.code) {
      case 'G0':
      case 'G1':
        applyMove(line)
        break
      case 'G2':
      case 'G3':
        arcLineIndexes.push(line.index)
        applyMove(line)
        break
      case 'G90':
        absolutePositioning = true
        break
      case 'G91':
        absolutePositioning = false
        break
      case 'M82':
        absoluteExtrusion = true
        break
      case 'M83':
        absoluteExtrusion = false
        break
      case 'G92':
        if (line.words.X !== undefined) x = line.words.X
        if (line.words.Y !== undefined) y = line.words.Y
        if (line.words.Z !== undefined) z = line.words.Z
        if (line.words.E !== undefined) e = line.words.E
        break
      case 'G28':
        x = 0
        y = 0
        z = 0
        break
      case 'M104':
      case 'M109':
        temperatureLines.push({
          lineIndex: line.index,
          code: line.code,
          target: line.words.S ?? line.words.R ?? null,
          tool: line.words.T ?? null,
          layerZ: currentLayerZ,
        })
        break
      default:
        if (line.code !== null && line.code.startsWith('T')) {
          const tool = Number(line.code.slice(1))
          if (Number.isInteger(tool) && tool >= 0) toolsUsed.add(tool)
        }
    }
    lineLayerZ[line.index] = currentLayerZ
  }

  return {
    layers,
    hasExtrusion,
    maxLayerZ: layers.reduce((max, layer) => Math.max(max, layer.z), 0),
    arcLineIndexes,
    toolsUsed: [...toolsUsed].sort((a, b) => a - b),
    temperatureLines,
    lineLayerZ,
  }
}

/** The most common layer height after the first layer, or the first layer's height. */
export const typicalLayerHeight = (layers: readonly Layer[]): number => {
  const counts = new Map<number, number>()
  for (const layer of layers.slice(1)) {
    if (layer.descending) continue
    counts.set(layer.height, (counts.get(layer.height) ?? 0) + 1)
  }
  let best: number | null = null
  let bestCount = 0
  for (const [height, count] of counts) {
    if (count > bestCount) {
      best = height
      bestCount = count
    }
  }
  return best ?? layers[0]?.height ?? 0
}
