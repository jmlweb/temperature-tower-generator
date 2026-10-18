import { tierBoundaryZ, tierCount, tierTemperature, towerHeight, type TowerConfig } from '@temptower/core'
import { GLYPH_ROWS, textCells, textColumns } from './font.ts'
import type { ManifoldModule } from './manifold.ts'

/**
 * Tier footprint in mm, laid out left to right like the Smart Compact tower
 * users already know: a 45° overhang eave, a bridge on two pillars, two
 * stringing cones, then the label body. Every tier shares it so blocks stack.
 */
export const TOWER_DIMENSIONS = {
  depth: 10,
  /** The base plate extends this far in front of and behind the tiers for adhesion. */
  plateFrontMargin: 9,
  plateSideMargin: 1,
  /** The eave's run (and rise, at 45°) is capped here and by `h - 1` so it clears the tier below. */
  overhangMaxRun: 9,
  bridgePillarWidth: 2,
  bridgeGap: 6,
  bridgeThickness: 2,
  coneZoneWidth: 12,
  coneBaseRadius: 2.5,
  coneTopRadius: 0.75,
  coneSegments: 24,
  bodyWidth: 14,
  gapBetweenFeatures: 1,
  labelHeight: 5,
  labelDepth: 0.8,
} as const

const D = TOWER_DIMENSIONS
const BRIDGE_WIDTH = 2 * D.bridgePillarWidth + D.bridgeGap

/**
 * Each cone reaches this far into the cone above so the union shares volume,
 * not a single point, and stays one manifold shell.
 */
const CONE_OVERLAP = 0.1

interface TierLayout {
  readonly run: number
  readonly bridgeX: number
  readonly conesX: number
  readonly bodyX: number
  readonly width: number
}

/** X offsets of the features of a tier `h` mm tall; the eave starts at x = 0. */
const tierLayout = (h: number): TierLayout => {
  const run = Math.min(D.overhangMaxRun, h - 1)
  const bridgeX = run
  const conesX = bridgeX + BRIDGE_WIDTH + D.gapBetweenFeatures
  const bodyX = conesX + D.coneZoneWidth + D.gapBetweenFeatures
  return { run, bridgeX, conesX, bodyX, width: bodyX + D.bodyWidth }
}

/** Width of the tiers (not the plate) for a block height; 47 mm at 10 mm like the Smart Compact tower. */
export const towerWidth = (blockHeight: number): number => tierLayout(blockHeight).width

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

const labelLayout = (config: TowerConfig, tier: number, layout: TierLayout): TowerLabel => {
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
    x: layout.bodyX + (D.bodyWidth - width) / 2,
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

/** Bridge pillars and deck, plus the label body. The eave and cones are not boxes. */
const tierBoxes = (z0: number, h: number, layout: TierLayout): readonly Box[] => [
  { x: layout.bridgeX, y: 0, z: z0, w: D.bridgePillarWidth, d: D.depth, h: h - D.bridgeThickness },
  { x: layout.bridgeX + D.bridgePillarWidth + D.bridgeGap, y: 0, z: z0, w: D.bridgePillarWidth, d: D.depth, h: h - D.bridgeThickness },
  { x: layout.bridgeX, y: 0, z: z0 + h - D.bridgeThickness, w: BRIDGE_WIDTH, d: D.depth, h: D.bridgeThickness },
  { x: layout.bodyX, y: 0, z: z0, w: D.bodyWidth, d: D.depth, h },
]

/** Generates the parametric tower (ADR-0006) and returns a plain triangle mesh plus label metadata. */
export const buildTower = (wasm: ManifoldModule, config: TowerConfig): TowerMesh => {
  const { Manifold, CrossSection } = wasm
  const parts: InstanceType<typeof Manifold>[] = []
  const box = ({ x, y, z, w, d, h }: Box) => parts.push(Manifold.cube([w, d, h], false).translate(x, y, z))

  const h = config.blockHeight
  const layout = tierLayout(h)

  box({
    x: -D.plateSideMargin,
    y: -D.plateFrontMargin,
    z: 0,
    w: layout.width + 2 * D.plateSideMargin,
    d: D.depth + 2 * D.plateFrontMargin,
    h: config.baseHeight,
  })

  const labels: TowerLabel[] = []
  const n = tierCount(config)
  for (let tier = 0; tier < n; tier += 1) {
    const z0 = tierBoundaryZ(config, tier)
    tierBoxes(z0, h, layout).forEach(box)

    // 45° eave: flat top at the tier top, underside rising from the bridge's
    // left pillar outwards. A right triangle in the XZ plane, extruded through
    // the depth, whose vertical edge sits inside the pillar so the union shares
    // volume with it instead of a coplanar face.
    const eaveX = layout.bridgeX + D.bridgePillarWidth / 2
    const profile = new CrossSection([
      [
        [eaveX, z0 + h - layout.run],
        [eaveX, z0 + h],
        [layout.bridgeX - layout.run, z0 + h],
      ],
    ])
    parts.push(Manifold.extrude(profile, D.depth).rotate(90, 0, 0).translate(0, D.depth, 0))
    profile.delete()

    // Stringing cones: each one overlaps the base of the cone above, except on the top tier.
    const coneHeight = tier === n - 1 ? h : h + CONE_OVERLAP
    for (const offset of [D.coneZoneWidth / 4, (3 * D.coneZoneWidth) / 4]) {
      parts.push(
        Manifold.cylinder(coneHeight, D.coneBaseRadius, D.coneTopRadius, D.coneSegments, false).translate(
          layout.conesX + offset,
          D.depth / 2,
          z0,
        ),
      )
    }

    const label = labelLayout(config, tier, layout)
    labels.push(label)
    labelBoxes(label).forEach(box)
  }

  const tower = Manifold.union(parts)
  const mesh = weldMesh(tower.getMesh())
  tower.delete()
  for (const part of parts) part.delete()

  return { mesh, labels, height: towerHeight(config) }
}

/**
 * Copies the CSG output into a plain mesh, merging vertices that coincide in
 * single precision and dropping the triangles that collapse. Where a flush
 * face meets another part's edge (the eave top on the bridge deck) the
 * boolean emits two vertices a rounding error apart, which an STL cannot keep
 * distinct; welding them keeps the mesh a single closed shell.
 */
const weldMesh = (mesh: { readonly vertProperties: Float32Array; readonly triVerts: Uint32Array; readonly numProp: number }): TriangleMesh => {
  const vertexCount = mesh.vertProperties.length / mesh.numProp
  const positions: number[] = []
  const indexByPosition = new Map<string, number>()
  const remap = new Uint32Array(vertexCount)
  for (let v = 0; v < vertexCount; v += 1) {
    const x = mesh.vertProperties[v * mesh.numProp]!
    const y = mesh.vertProperties[v * mesh.numProp + 1]!
    const z = mesh.vertProperties[v * mesh.numProp + 2]!
    const key = `${x},${y},${z}`
    let index = indexByPosition.get(key)
    if (index === undefined) {
      index = positions.length / 3
      indexByPosition.set(key, index)
      positions.push(x, y, z)
    }
    remap[v] = index
  }
  const triangles: number[] = []
  for (let t = 0; t < mesh.triVerts.length; t += 3) {
    const a = remap[mesh.triVerts[t]!]!
    const b = remap[mesh.triVerts[t + 1]!]!
    const c = remap[mesh.triVerts[t + 2]!]!
    if (a !== b && b !== c && a !== c) triangles.push(a, b, c)
  }
  return { positions: new Float32Array(positions), triangles: new Uint32Array(triangles) }
}
