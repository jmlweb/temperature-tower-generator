import { describe, expect, it } from 'vitest'
import { MATERIAL_PRESETS, Material, temperaturesOutsidePreset, tierBoundaryZ, tierCount, tierStartZ, tierTemperatures, towerHeight, validateTowerConfig, type TowerConfig } from './tower-config.ts'

const pla: TowerConfig = {
  material: Material.PLA,
  startTemperature: 230,
  endTemperature: 190,
  step: 5,
  blockHeight: 10,
  baseHeight: 2,
  waitForTemperature: false,
}

describe('tower config', () => {
  it('counts tiers inclusively in both directions', () => {
    expect(tierCount(pla)).toBe(9)
    expect(tierCount({ ...pla, startTemperature: 190, endTemperature: 230 })).toBe(9)
    expect(tierCount({ ...pla, endTemperature: 193 })).toBe(8)
  })

  it('lists tier temperatures from the bottom tier up', () => {
    expect(tierTemperatures(pla)).toEqual([230, 225, 220, 215, 210, 205, 200, 195, 190])
  })

  it('places tier i at b + i·h and the top at b + n·h', () => {
    expect(tierBoundaryZ(pla, 0)).toBe(2)
    expect(tierBoundaryZ(pla, 3)).toBe(32)
    expect(towerHeight(pla)).toBe(92)
    expect(tierBoundaryZ({ ...pla, blockHeight: 7.5, baseHeight: 1.2 }, 2)).toBe(16.2)
  })

  it('lists tier temperatures outside the preset range, none for Custom', () => {
    expect(temperaturesOutsidePreset(pla)).toEqual([])
    expect(temperaturesOutsidePreset({ ...pla, startTemperature: 245, endTemperature: 225 })).toEqual([245, 240])
    expect(temperaturesOutsidePreset({ ...pla, material: Material.CUSTOM, startTemperature: 300, endTemperature: 280 })).toEqual([])
  })

  it('starts tier 0 at Z 0 and every other tier at its boundary (ADR-0009)', () => {
    expect(tierStartZ(pla, 0)).toBe(0)
    expect(tierStartZ(pla, 1)).toBe(tierBoundaryZ(pla, 1))
    expect(tierStartZ(pla, 3)).toBe(tierBoundaryZ(pla, 3))
  })

  it('rejects impossible configs', () => {
    expect(validateTowerConfig(pla)).toEqual([])
    expect(validateTowerConfig({ ...pla, step: 0 })).toContain('step must be positive')
    expect(validateTowerConfig({ ...pla, endTemperature: 230 })).toContain('start and end temperature must differ')
    expect(validateTowerConfig({ ...pla, blockHeight: 3 })).toContain('block height must be at least 6 mm')
    expect(validateTowerConfig({ ...pla, step: 1 })).toContain('at most 20 tiers')
  })

  it('rejects a step that leaves one tier or misses the top tier (ADR-0013)', () => {
    expect(validateTowerConfig({ ...pla, startTemperature: 230, endTemperature: 228, step: 5 })).toEqual([
      'step 5 °C is larger than the 2 °C range, so the tower would have 1 tier; use at least 2 tiers',
    ])
    expect(validateTowerConfig({ ...pla, startTemperature: 230, endTemperature: 190, step: 15 })).toEqual([
      'step 15 °C does not reach the top tier 190 °C; use 200 or 185 °C, or another step',
    ])
    expect(validateTowerConfig({ ...pla, startTemperature: 190, endTemperature: 230, step: 15 })).toEqual([
      'step 15 °C does not reach the top tier 230 °C; use 220 or 235 °C, or another step',
    ])
  })

  it('keeps every material preset valid', () => {
    for (const preset of MATERIAL_PRESETS) expect(validateTowerConfig(preset.config), preset.label).toEqual([])
  })
})
