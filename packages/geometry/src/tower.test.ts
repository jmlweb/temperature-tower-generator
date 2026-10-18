import { Material, tierBoundaryZ, tierTemperature, towerHeight, type TowerConfig } from '@temptower/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { textBitmap } from './font.ts'
import { loadManifold, type ManifoldModule } from './manifold.ts'
import { isManifold, meshHeight, readLabel } from './mesh-checks.ts'
import { readBinaryStl, writeBinaryStl } from './stl.ts'
import { buildTower } from './tower.ts'

const config: TowerConfig = {
  material: Material.PLA,
  startTemperature: 230,
  endTemperature: 215,
  step: 5,
  blockHeight: 8,
  baseHeight: 2,
  waitForTemperature: false,
}

describe('parametric tower (ADR-0006)', () => {
  let wasm: ManifoldModule
  beforeAll(async () => {
    wasm = await loadManifold()
  })

  it('builds a manifold mesh whose height is b + n·h', () => {
    const tower = buildTower(wasm, config)
    expect(isManifold(tower.mesh)).toBe(true)
    expect(meshHeight(tower.mesh)).toBe(towerHeight(config))
    expect(tower.height).toBe(2 + 4 * 8)
  })

  it('shows each tier temperature as that tier label, read back from the mesh', () => {
    const tower = buildTower(wasm, config)
    expect(tower.labels.map((label) => label.text)).toEqual(['230', '225', '220', '215'])
    for (const label of tower.labels) {
      expect(label.temperature).toBe(tierTemperature(config, label.tier))
      expect(label.zTop).toBeGreaterThan(tierBoundaryZ(config, label.tier))
      expect(label.zTop).toBeLessThanOrEqual(tierBoundaryZ(config, label.tier + 1))
      expect(readLabel(tower.mesh, label), `tier ${label.tier}`).toEqual(textBitmap(label.text))
    }
  })

  it('survives a binary STL round trip as a manifold mesh', () => {
    const tower = buildTower(wasm, { ...config, material: Material.PETG, startTemperature: 250, endTemperature: 240 })
    const bytes = writeBinaryStl(tower.mesh)
    const back = readBinaryStl(bytes)
    expect(back.triangles.length).toBe(tower.mesh.triangles.length)
    expect(isManifold(back)).toBe(true)
    expect(meshHeight(back)).toBe(2 + 3 * 8)
  })

  it('rejects the known-bad mesh in the manifold check', () => {
    const open = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), triangles: new Uint32Array([0, 1, 2]) }
    expect(isManifold(open)).toBe(false)
  })
})
