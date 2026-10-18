import { describe, expect, it } from 'vitest'
import { Material, tierBoundaryZ, tierCount, tierTemperatures, towerHeight, validateTowerConfig, type TowerConfig } from './tower-config.ts'

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

  it('rejects impossible configs', () => {
    expect(validateTowerConfig(pla)).toEqual([])
    expect(validateTowerConfig({ ...pla, step: 0 })).toContain('step must be positive')
    expect(validateTowerConfig({ ...pla, endTemperature: 230 })).toContain('start and end temperature must differ')
    expect(validateTowerConfig({ ...pla, blockHeight: 3 })).toContain('block height must be at least 6 mm')
    expect(validateTowerConfig({ ...pla, step: 1 })).toContain('at most 20 tiers')
  })
})
