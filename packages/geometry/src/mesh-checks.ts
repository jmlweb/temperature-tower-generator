import type { TowerLabel, TriangleMesh } from './tower.ts'

const positionKey = (mesh: TriangleMesh, vertex: number): string => {
  const i = vertex * 3
  return `${mesh.positions[i]},${mesh.positions[i + 1]},${mesh.positions[i + 2]}`
}

/**
 * A mesh is manifold here when every edge (by position, independent of vertex
 * welding) is used exactly once in each direction and no triangle is degenerate.
 */
export const isManifold = (mesh: TriangleMesh): boolean => {
  const directed = new Map<string, number>()
  const triangleCount = mesh.triangles.length / 3
  for (let t = 0; t < triangleCount; t += 1) {
    const keys = [0, 1, 2].map((corner) => positionKey(mesh, mesh.triangles[t * 3 + corner]!))
    if (new Set(keys).size < 3) return false
    for (let corner = 0; corner < 3; corner += 1) {
      const edge = `${keys[corner]}->${keys[(corner + 1) % 3]}`
      directed.set(edge, (directed.get(edge) ?? 0) + 1)
    }
  }
  for (const [edge, count] of directed) {
    if (count !== 1) return false
    const [from, to] = edge.split('->')
    if (directed.get(`${to}->${from}`) !== 1) return false
  }
  return true
}

export const meshBounds = (mesh: TriangleMesh): { min: [number, number, number]; max: [number, number, number] } => {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < mesh.positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = mesh.positions[i + axis]!
      if (value < min[axis]!) min[axis] = value
      if (value > max[axis]!) max[axis] = value
    }
  }
  return { min, max }
}

export const meshHeight = (mesh: TriangleMesh): number => {
  const { min, max } = meshBounds(mesh)
  return Math.round((max[2] - min[2]) * 1000) / 1000
}

const pointInTriangle = (px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean => {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNegative && hasPositive)
}

/**
 * Rasterizes the raised label face back into `#`/`.` rows by testing each cell
 * centre against the triangles lying on the label's front plane.
 */
export const readLabel = (mesh: TriangleMesh, label: TowerLabel): readonly string[] => {
  const tolerance = 1e-3
  const faceTriangles: number[][] = []
  const triangleCount = mesh.triangles.length / 3
  for (let t = 0; t < triangleCount; t += 1) {
    const corners = [0, 1, 2].map((corner) => mesh.triangles[t * 3 + corner]! * 3)
    if (corners.every((i) => Math.abs(mesh.positions[i + 1]! - label.faceY) < tolerance)) {
      faceTriangles.push(corners.flatMap((i) => [mesh.positions[i]!, mesh.positions[i + 2]!]))
    }
  }
  const rows: string[] = []
  for (let row = 0; row < label.rows; row += 1) {
    let line = ''
    for (let column = 0; column < label.columns; column += 1) {
      const px = label.x + (column + 0.5) * label.cell
      const pz = label.zTop - (row + 0.5) * label.cell
      const filled = faceTriangles.some(([ax, az, bx, bz, cx, cz]) => pointInTriangle(px, pz, ax!, az!, bx!, bz!, cx!, cz!))
      line += filled ? '#' : '.'
    }
    rows.push(line)
  }
  return rows
}
