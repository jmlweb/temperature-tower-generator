import { tierBoundaryZ, tierCount, tierTemperature, towerHeight, type TowerConfig } from '@temptower/core'
import { GLYPH_ROWS, textCells, textColumns } from './font.ts'
import type { ManifoldModule } from './manifold.ts'

/**
 * One tier is a solid bar with the test features of the Smart Compact tower
 * cut into it, measured from that model at a 10 mm block: a variable-angle
 * overhang under the left end, a through window whose left wall runs
 * diagonally so the bridge span grows from the back to the front, a keyhole
 * with a spike inside near the right end, a rounded nose, chamfered long
 * edges and the temperature engraved on the front face. Vertical features
 * scale with the block height; plan dimensions stay fixed so tiers stack.
 * Dimensions are mm; x runs along the bar, y through its depth, z up.
 */
export const TOWER_DIMENSIONS = {
  depth: 10,
  bodyLength: 40,
  noseRadius: 5,
  chamfer: 0.4,
  /** Block height the vertical features were measured at. */
  referenceBlockHeight: 10,
  /** Underside of the overhang from the bottom to the left tip: [x, z] pairs. Segments are 30°, 45°, 60° and 65° from vertical. */
  overhangProfile: [
    [9.5, 0],
    [7.24, 3.9],
    [4.41, 6.73],
    [1.81, 8.23],
    [0, 9.07],
  ],
  windowFloor: 5,
  deckThickness: 0.8,
  windowFrontStart: 3.5,
  windowBackStart: 18.5,
  windowEnd: 33.5,
  holeX: 38.9,
  holeZ: 5.3,
  holeRadius: 3.9,
  slotWidth: 2.4,
  slotFloor: 1,
  spikeRadius: 1.2,
  spikeTop: 8.7,
  labelX: 22,
  labelBottom: 0.4,
  labelHeight: 4.2,
  labelDepth: 0.6,
  plateStart: 3.8,
  plateEnd: 46.7,
  platePadDepth: 28,
  plateWaistDepth: 11,
  platePadLength: 2.2,
  plateTransition: 10,
  circularSegments: 48,
} as const

const D = TOWER_DIMENSIONS

/** Length of a tier from the overhang tip to the nose. */
export const TOWER_WIDTH = D.bodyLength + D.noseRadius

/** Cutting tools reach this far past the faces they open, so no face is left coplanar with a cut. */
const CUT_MARGIN = 0.5

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
  /** Y of the engraved label floor, behind the front face at y = 0. */
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

type Point = readonly [number, number]

const verticalScale = (blockHeight: number): number => blockHeight / D.referenceBlockHeight

const labelLayout = (config: TowerConfig, tier: number): TowerLabel => {
  const temperature = tierTemperature(config, tier)
  const text = String(temperature)
  const s = verticalScale(config.blockHeight)
  const cell = (D.labelHeight * s) / GLYPH_ROWS
  const z0 = tierBoundaryZ(config, tier)
  return {
    tier,
    temperature,
    text,
    x: D.labelX,
    zTop: z0 + (D.labelBottom + D.labelHeight) * s,
    cell,
    columns: textColumns(text),
    rows: GLYPH_ROWS,
    faceY: D.labelDepth,
  }
}

/**
 * Engraved label pixels as cutting boxes, merging horizontal runs to keep the
 * boolean small. Each run grows by a small overlap so diagonally touching
 * pixels share volume, not just an edge, and the engraving stays one pocket.
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
        y: -CUT_MARGIN,
        z: label.zTop - (row + 1) * label.cell - PIXEL_OVERLAP,
        w: (end - runStart + 1) * label.cell + 2 * PIXEL_OVERLAP,
        d: CUT_MARGIN + D.labelDepth,
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

/** Half depth of the plate at `x`: wide pads at both ends, a waist under the tiers, cosine transitions. */
const plateHalfDepth = (x: number): number => {
  const pad = D.platePadDepth / 2
  const waist = D.plateWaistDepth / 2
  const leftEnd = D.plateStart + D.platePadLength
  const rightEnd = D.plateEnd - D.platePadLength
  const blend = (t: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, t)))) / 2
  if (x < leftEnd + D.plateTransition) return pad - (pad - waist) * blend((x - leftEnd) / D.plateTransition)
  if (x > rightEnd - D.plateTransition) return pad - (pad - waist) * blend((rightEnd - x) / D.plateTransition)
  return waist
}

const platePolygon = (): Point[] => {
  const steps = 60
  const xs = Array.from({ length: steps + 1 }, (_, i) => D.plateStart + ((D.plateEnd - D.plateStart) * i) / steps)
  const centre = D.depth / 2
  const front = xs.map((x): Point => [x, centre - plateHalfDepth(x)])
  const back = [...xs].reverse().map((x): Point => [x, centre + plateHalfDepth(x)])
  return [...front, ...back]
}

/** Generates the parametric tower (ADR-0006) and returns a plain triangle mesh plus label metadata. */
export const buildTower = (wasm: ManifoldModule, config: TowerConfig): TowerMesh => {
  const { Manifold, CrossSection } = wasm
  type Solid = InstanceType<typeof Manifold>
  const garbage: Solid[] = []
  const keep = (solid: Solid): Solid => {
    garbage.push(solid)
    return solid
  }
  const box = ({ x, y, z, w, d, h }: Box): Solid => keep(Manifold.cube([w, d, h], false).translate(x, y, z))
  /** Extrudes an (x, z) polygon along y from `y0`. */
  const extrudeXZ = (points: readonly Point[], y0: number, length: number): Solid => {
    const section = new CrossSection([points.map(([x, z]) => [x, z] as [number, number])])
    const solid = keep(Manifold.extrude(section, length).rotate(90, 0, 0).translate(0, y0 + length, 0))
    section.delete()
    return solid
  }
  /** Extrudes a (z, y) polygon along x from `x0`. */
  const extrudeYZ = (points: readonly Point[], x0: number, length: number): Solid => {
    const section = new CrossSection([points.map(([z, y]) => [z, y] as [number, number])])
    const solid = keep(Manifold.extrude(section, length).rotate(0, -90, 0).translate(x0 + length, 0, 0))
    section.delete()
    return solid
  }
  /** Extrudes an (x, y) polygon up from `z0`. */
  const extrudeXY = (points: readonly Point[], z0: number, height: number): Solid => {
    const section = new CrossSection([points.map(([x, y]) => [x, y] as [number, number])])
    const solid = keep(Manifold.extrude(section, height).translate(0, 0, z0))
    section.delete()
    return solid
  }
  /** A cylinder whose axis runs along y through the whole depth plus margins. */
  const cylinderAlongY = (x: number, z: number, radius: number): Solid =>
    keep(
      Manifold.cylinder(D.depth + 2 * CUT_MARGIN, radius, radius, D.circularSegments, false)
        .rotate(90, 0, 0)
        .translate(x, D.depth + CUT_MARGIN, z),
    )

  const h = config.blockHeight
  const s = verticalScale(h)
  const c = D.chamfer
  const n = tierCount(config)
  const labels = Array.from({ length: n }, (_, i) => labelLayout(config, i))

  const tier = (label: TowerLabel): Solid => {
    const z0 = tierBoundaryZ(config, label.tier)
    // Side profile: flat top, overhang underside stepping up to the left tip, flat bottom.
    const underside = D.overhangProfile.slice().reverse().map(([x, z]): Point => [x * s, z0 + z * s])
    const sideProfile = extrudeXZ([[0, z0 + h], ...underside, [D.bodyLength, z0], [D.bodyLength, z0 + h]], 0, D.depth)
    // Chamfered long edges: an octagon in the (z, y) plane swept along x, wound counter-clockwise.
    const octagon: Point[] = [
      [z0, c],
      [z0 + c, 0],
      [z0 + h - c, 0],
      [z0 + h, c],
      [z0 + h, D.depth - c],
      [z0 + h - c, D.depth],
      [z0 + c, D.depth],
      [z0, D.depth - c],
    ]
    const chamferedBar = extrudeYZ(octagon, -CUT_MARGIN, TOWER_WIDTH + 2 * CUT_MARGIN)
    const body = keep(Manifold.intersection([sideProfile, chamferedBar]))

    // Rounded nose: the bar past the body, rounded in plan and in elevation.
    const noseBox = box({ x: D.bodyLength - CUT_MARGIN, y: -CUT_MARGIN, z: z0, w: D.noseRadius + 2 * CUT_MARGIN, d: D.depth + 2 * CUT_MARGIN, h })
    const noseInPlan = keep(
      Manifold.cylinder(h + 2 * CUT_MARGIN, D.noseRadius, D.noseRadius, D.circularSegments, false).translate(D.bodyLength, D.depth / 2, z0 - CUT_MARGIN),
    )
    const noseInElevation = cylinderAlongY(D.bodyLength, z0 + D.holeZ * s, D.noseRadius * s)
    const nose = keep(Manifold.intersection([noseBox, noseInPlan, noseInElevation, chamferedBar]))

    // Window: a slot through the depth whose left wall runs diagonally in plan.
    const slope = (D.windowBackStart - D.windowFrontStart) / D.depth
    const windowPlan: Point[] = [
      [D.windowFrontStart - slope * CUT_MARGIN, -CUT_MARGIN],
      [D.windowEnd, -CUT_MARGIN],
      [D.windowEnd, D.depth + CUT_MARGIN],
      [D.windowBackStart + slope * CUT_MARGIN, D.depth + CUT_MARGIN],
    ]
    const floor = D.windowFloor * s
    const window = extrudeXY(windowPlan, z0 + floor, h - D.deckThickness - floor)

    // Keyhole: a round hole through the depth with a narrow slot below it, and a spike standing in the slot.
    const hole = cylinderAlongY(D.holeX, z0 + D.holeZ * s, D.holeRadius * s)
    const slot = box({
      x: D.holeX - (D.slotWidth * s) / 2,
      y: -CUT_MARGIN,
      z: z0 + D.slotFloor * s,
      w: D.slotWidth * s,
      d: D.depth + 2 * CUT_MARGIN,
      h: (D.holeZ - D.slotFloor) * s,
    })
    const spikeBase = z0 + D.slotFloor * s - CUT_MARGIN
    const spike = keep(
      Manifold.cylinder(z0 + D.spikeTop * s - spikeBase, D.spikeRadius * s, 0, D.circularSegments, false).translate(D.holeX, D.depth / 2, spikeBase),
    )

    const engraving = labelBoxes(label).map(box)
    const cut = keep(Manifold.difference([keep(Manifold.union([body, nose])), window, hole, slot, ...engraving]))
    return keep(Manifold.union([cut, spike]))
  }

  const plate = extrudeXY(platePolygon(), 0, config.baseHeight)
  const tower = Manifold.union([plate, ...labels.map(tier)])
  const mesh = weldMesh(tower.getMesh())
  tower.delete()
  for (const solid of garbage) solid.delete()

  return { mesh, labels, height: towerHeight(config) }
}

/**
 * Copies the CSG output into a plain mesh, merging vertices that coincide in
 * single precision and dropping the triangles that collapse. Where a flush
 * face meets another part's edge the boolean emits two vertices a rounding
 * error apart, which an STL cannot keep distinct; welding them keeps the
 * mesh a single closed shell.
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
