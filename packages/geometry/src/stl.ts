import type { TriangleMesh } from './tower.ts'

const HEADER_BYTES = 80
const TRIANGLE_BYTES = 50

/** Binary STL: 80-byte header, uint32 count, then normal + 3 vertices + uint16 per triangle. */
export const writeBinaryStl = (mesh: TriangleMesh, header = 'temptower'): Uint8Array => {
  const triangleCount = mesh.triangles.length / 3
  const buffer = new ArrayBuffer(HEADER_BYTES + 4 + triangleCount * TRIANGLE_BYTES)
  const view = new DataView(buffer)
  const headerBytes = new Uint8Array(buffer, 0, HEADER_BYTES)
  for (let i = 0; i < Math.min(header.length, HEADER_BYTES); i += 1) headerBytes[i] = header.charCodeAt(i) & 0x7f
  view.setUint32(HEADER_BYTES, triangleCount, true)

  let offset = HEADER_BYTES + 4
  const p = mesh.positions
  for (let t = 0; t < triangleCount; t += 1) {
    const a = mesh.triangles[t * 3]! * 3
    const b = mesh.triangles[t * 3 + 1]! * 3
    const c = mesh.triangles[t * 3 + 2]! * 3
    const ux = p[b]! - p[a]!
    const uy = p[b + 1]! - p[a + 1]!
    const uz = p[b + 2]! - p[a + 2]!
    const vx = p[c]! - p[a]!
    const vy = p[c + 1]! - p[a + 1]!
    const vz = p[c + 2]! - p[a + 2]!
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const length = Math.hypot(nx, ny, nz) || 1
    view.setFloat32(offset, nx / length, true)
    view.setFloat32(offset + 4, ny / length, true)
    view.setFloat32(offset + 8, nz / length, true)
    offset += 12
    for (const index of [a, b, c]) {
      view.setFloat32(offset, p[index]!, true)
      view.setFloat32(offset + 4, p[index + 1]!, true)
      view.setFloat32(offset + 8, p[index + 2]!, true)
      offset += 12
    }
    view.setUint16(offset, 0, true)
    offset += 2
  }
  return new Uint8Array(buffer)
}

/** Reads a binary STL back into an unwelded triangle soup (for tests). */
export const readBinaryStl = (bytes: Uint8Array): TriangleMesh => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const triangleCount = view.getUint32(HEADER_BYTES, true)
  const positions = new Float32Array(triangleCount * 9)
  const triangles = new Uint32Array(triangleCount * 3)
  let offset = HEADER_BYTES + 4
  for (let t = 0; t < triangleCount; t += 1) {
    offset += 12
    for (let v = 0; v < 3; v += 1) {
      const base = (t * 3 + v) * 3
      positions[base] = view.getFloat32(offset, true)
      positions[base + 1] = view.getFloat32(offset + 4, true)
      positions[base + 2] = view.getFloat32(offset + 8, true)
      triangles[t * 3 + v] = t * 3 + v
      offset += 12
    }
    offset += 2
  }
  return { positions, triangles }
}
