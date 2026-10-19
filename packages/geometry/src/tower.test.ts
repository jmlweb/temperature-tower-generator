import { MATERIAL_PRESETS, Material, findPreset, tierBoundaryZ, tierCount, tierTemperature, towerHeight, type TowerConfig } from '@temptower/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { textBitmap } from './font.ts'
import { loadManifold, type ManifoldModule } from './manifold.ts'
import { isManifold, meshBounds, meshHeight, readLabel } from './mesh-checks.ts'
import { readBinaryStl, writeBinaryStl } from './stl.ts'
import { TOWER_DIMENSIONS, TOWER_WIDTH, buildTower } from './tower.ts'

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

  it('makes each tier 45 mm long like the Smart Compact tower', () => {
    expect(TOWER_WIDTH).toBe(45)
  })

  it('stays manifold at full height for the fixture config and every preset', () => {
    const fixture: TowerConfig = { ...config, startTemperature: 230, endTemperature: 220, blockHeight: 6, baseHeight: 1 }
    for (const candidate of [fixture, ...MATERIAL_PRESETS.map((preset) => preset.config)]) {
      const tower = buildTower(wasm, candidate)
      expect(isManifold(tower.mesh), `${candidate.material} h${candidate.blockHeight}`).toBe(true)
      expect(meshHeight(tower.mesh)).toBe(towerHeight(candidate))
      expect(tower.labels).toHaveLength(tierCount(candidate))
    }
  })

  it('spans the dogbone plate footprint', () => {
    const pla = findPreset(Material.PLA).config
    const { min, max } = meshBounds(buildTower(wasm, pla).mesh)
    const D = TOWER_DIMENSIONS
    // The overhang tip at x = 0 reaches past the plate, as on the Smart Compact tower.
    expect(min[0]).toBeCloseTo(0, 3)
    expect(max[0]).toBeCloseTo(D.plateEnd, 3)
    expect(min[1]).toBeCloseTo(D.depth / 2 - D.platePadDepth / 2, 3)
    expect(max[1]).toBeCloseTo(D.depth / 2 + D.platePadDepth / 2, 3)
    expect(min[2]).toBe(0)
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
