import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { decodeTowerConfigName, encodeTowerConfigName } from './filename-codec.ts'
import { Material, type TowerConfig } from './tower-config.ts'

const towerConfigArbitrary = (): fc.Arbitrary<TowerConfig> =>
  fc.record({
    material: fc.constantFrom(...Object.values(Material)),
    startTemperature: fc.integer({ min: 150, max: 320 }),
    endTemperature: fc.integer({ min: 150, max: 320 }),
    step: fc.integer({ min: 1, max: 20 }),
    blockHeight: fc.integer({ min: 60, max: 300 }).map((n) => n / 10),
    baseHeight: fc.integer({ min: 10, max: 50 }).map((n) => n / 10),
    waitForTemperature: fc.boolean(),
  })

describe('filename codec', () => {
  it('encodes a readable, versioned base name', () => {
    const config: TowerConfig = {
      material: Material.PLA,
      startTemperature: 230,
      endTemperature: 190,
      step: 5,
      blockHeight: 10,
      baseHeight: 2,
      waitForTemperature: false,
    }
    expect(encodeTowerConfigName(config)).toBe('temptower_v1_PLA_230to190_step5_h10_b2_m104')
  })

  it('decodes from a PrusaSlicer output name with suffixes', () => {
    const decoded = decodeTowerConfigName('temptower_v1_PETG_255to225_step5_h10_b2.5_m109_0.2mm_PETG_MK3S_1h12m.gcode')
    expect(decoded).toEqual({
      material: Material.PETG,
      startTemperature: 255,
      endTemperature: 225,
      step: 5,
      blockHeight: 10,
      baseHeight: 2.5,
      waitForTemperature: true,
    })
  })

  it('returns null for unrelated names', () => {
    expect(decodeTowerConfigName('benchy_0.2mm_PLA_MK3S.gcode')).toBeNull()
    expect(decodeTowerConfigName('temptower_v0_PLA_230to190.gcode')).toBeNull()
  })

  test.prop([towerConfigArbitrary()])('round-trips losslessly', (config) => {
    expect(decodeTowerConfigName(`${encodeTowerConfigName(config)}.stl`)).toEqual(config)
  })
})
