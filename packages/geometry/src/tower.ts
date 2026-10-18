import { tierBoundaryZ, tierCount, tierTemperature, towerHeight, type TowerConfig } from '@temptower/core'
import { GLYPH_ROWS, textCells, textColumns } from './font.ts'
import type { ManifoldModule } from './manifold.ts'

/** Footprint of one tier block, in mm. Every tier shares it so blocks stack cleanly. */
export const TOWER_DIMENSIONS = {
  bodyWidth: 22,
  depth: 12,
  overhangRun: 4,
  bridgePillarWidth: 2,
  bridgeGap: 6,
  bridgeThickness: 2,
  pillarSize: 2,
  gapBetweenFeatures: 1,
  pillarGap: 3,
  baseMargin: 1,
  labelHeight: 5,
  labelDepth: 0.8,
} as const

const D = TOWER_DIMENSIONS
const BRIDGE_START = D.bodyWidth + D.overhangRun + D.gapBetweenFeatures
const BRIDGE_WIDTH = 2 * D.bridgePillarWidth + D.bridgeGap
const PILLAR_START = BRIDGE_START + BRIDGE_WIDTH + D.pillarGap
export const TOWER_WIDTH = PILLAR_START + D.pillarSize

export interface TriangleMesh {
  /** Flat XYZ positions, 3 per vertex. */
  readonly positions: Float32Array
  /** Vertex indices, 3 per triangle, counter-clockwise from outside. */
  readonly triangles: Uint32Array
}

export interface TowerLabel {
  readonly tier: number
  readonly temperature: number
  readonly text: string
  /** Left edge of the label raster on the front face. */
  readonly x: number
  /** Top edge of the label raster. */
  readonly zTop: number
  readonly cell: number
  readonly columns: number
  readonly rows: number
  /** Y of the raised label face. */
  readonly faceY: number
}

export interface TowerMesh {
  readonly mesh: TriangleMesh
  readonly labels: readonly TowerLabel[]
  readonly height: number
}

interface Box {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly w: number
  readonly d: number
  readonly h: number
}

const labelLayout = (config: TowerConfig, tier: number): TowerLabel => {
  const temperature = tierTemperature(config, tier)
  const text = String(temperature)
  const cell = D.labelHeight / GLYPH_ROWS
  const columns = textColumns(text)
  const width = columns * cell
  const z0 = tierBoundaryZ(config, tier)
  return {
    tier,
    temperature,
    text,
    x: (D.bodyWidth - width) / 2,
    zTop: z0 + (config.blockHeight - D.labelHeight) / 2 + D.labelHeight,
    cell,
    columns,
    rows: GLYPH_ROWS,
    faceY: -D.labelDepth,
  }
}

/**
 * Raised label pixels as boxes, merging horizontal runs to keep the union small.
 * Each run grows by a small overlap so diagonally touching pixels share volume,
 * not just an edge, and the union stays a single manifold shell.
 */
const PIXEL_OVERLAP = 0.1
const labelBoxes = (label: TowerLabel): readonly Box[] => {
  const cells = textCells(label.text)
  const boxes: Box[] = []
  for (let row = 0; row < label.rows; row += 1) {
    const columns = cells.filter((c) => c.row === row).map((c) => c.column).sort((a, b) => a - b)
    let runStart: number | null = null
    let previous = -2
    const flush = (end: number) => {
      if (runStart === null) return
      boxes.push({
        x: label.x + runStart * label.cell - PIXEL_OVERLAP,
        y: label.faceY,
        z: label.zTop - (row + 1) * label.cell - PIXEL_OVERLAP,
        w: (end - runStart + 1) * label.cell + 2 * PIXEL_OVERLAP,
        d: D.labelDepth,
        h: label.cell + 2 * PIXEL_OVERLAP,
      })
    }
    for (const column of columns) {
      if (column !== previous + 1) {
        flush(previous)
        runStart = column
      }
      previous = column
    }
    flush(previous)
  }
  return boxes
}

const tierBoxes = (z0: number, h: number): readonly Box[] => [
  { x: 0, y: 0, z: z0, w: D.bodyWidth, d: D.depth, h },
  { x: BRIDGE_START, y: 0, z: z0, w: D.bridgePillarWidth, d: D.depth, h: h - D.bridgeThickness },
  { x: BRIDGE_START + D.bridgePillarWidth + D.bridgeGap, y: 0, z: z0, w: D.bridgePillarWidth, d: D.depth, h: h - D.bridgeThickness },
  { x: BRIDGE_START, y: 0, z: z0 + h - D.bridgeThickness, w: BRIDGE_WIDTH, d: D.depth, h: D.bridgeThickness },
  { x: PILLAR_START, y: (D.depth - D.pillarSize) / 2, z: z0, w: D.pillarSize, d: D.pillarSize, h },
]

/** Generates the parametric tower (ADR-0006) and returns a plain triangle mesh plus label metadata. */
export const buildTower = (wasm: ManifoldModule, config: TowerConfig): TowerMesh => {
  const { Manifold, CrossSection } = wasm
  const parts: InstanceType<typeof Manifold>[] = []
  const box = ({ x, y, z, w, d, h }: Box) => parts.push(Manifold.cube([w, d, h], false).translate(x, y, z))

  box({
    x: -D.baseMargin,
    y: -D.baseMargin,
    z: 0,
    w: TOWER_WIDTH + 2 * D.baseMargin,
    d: D.depth + 2 * D.baseMargin,
    h: config.baseHeight,
  })

  const labels: TowerLabel[] = []
  const n = tierCount(config)
  const h = config.blockHeight
  for (let tier = 0; tier < n; tier += 1) {
    const z0 = tierBoundaryZ(config, tier)
    tierBoxes(z0, h).forEach(box)

    // 45° overhang: a right triangle in the XZ plane, extruded through the block depth.
    const rise = Math.min(D.overhangRun, h - 1)
    const run = rise
    const profile = new CrossSection([
      [
        [D.bodyWidth, z0 + h - rise],
        [D.bodyWidth + run, z0 + h],
        [D.bodyWidth, z0 + h],
      ],
    ])
    const overhang = Manifold.extrude(profile, D.depth).rotate(90, 0, 0).translate(0, D.depth, 0)
    profile.delete()
    parts.push(overhang)

    const label = labelLayout(config, tier)
    labels.push(label)
    labelBoxes(label).forEach(box)
  }

  const tower = Manifold.union(parts)
  const mesh = tower.getMesh()
  const positions = new Float32Array(mesh.vertProperties.length / mesh.numProp * 3)
  for (let v = 0; v < mesh.vertProperties.length / mesh.numProp; v += 1) {
    positions[v * 3] = mesh.vertProperties[v * mesh.numProp]!
    positions[v * 3 + 1] = mesh.vertProperties[v * mesh.numProp + 1]!
    positions[v * 3 + 2] = mesh.vertProperties[v * mesh.numProp + 2]!
  }
  const triangles = new Uint32Array(mesh.triVerts)
  tower.delete()
  for (const part of parts) part.delete()

  return { mesh: { positions, triangles }, labels, height: towerHeight(config) }
}
