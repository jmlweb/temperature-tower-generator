import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { decodeTowerConfigName, encodeTowerConfigName } from './filename-codec.ts'
import { LARGEST_NAME_NUMBER_EXCLUDED, Material, MIN_BASE_HEIGHT, MIN_BLOCK_HEIGHT, NAME_DECIMALS, roundToNameDecimals, validateTowerConfig, type TowerConfig } from './tower-config.ts'

const NAME_DECIMAL_SCALE = 10 ** NAME_DECIMALS

/** Every height validation accepts: thousandths up to the safe-integer limit, plus any coarser double below 1e21. */
const acceptedHeightArbitrary = (min: number): fc.Arbitrary<number> =>
  fc.oneof(
    fc.integer({ min: min * NAME_DECIMAL_SCALE, max: Number.MAX_SAFE_INTEGER }).map((n) => n / NAME_DECIMAL_SCALE),
    fc.double({ min, max: LARGEST_NAME_NUMBER_EXCLUDED, maxExcluded: true, noNaN: true }).filter((n) => roundToNameDecimals(n) === n),
  )

const validBase: TowerConfig = {
  material: Material.PLA,
  startTemperature: 230,
  endTemperature: 190,
  step: 5,
  blockHeight: 10,
  baseHeight: 2,
  waitForTemperature: false,
}

const towerConfigArbitrary = (): fc.Arbitrary<TowerConfig> =>
  fc.record({
    material: fc.constantFrom(...Object.values(Material)),
    startTemperature: fc.integer({ min: 150, max: 320 }),
    endTemperature: fc.integer({ min: 150, max: 320 }),
    step: fc.integer({ min: 1, max: 20 }),
    blockHeight: acceptedHeightArbitrary(MIN_BLOCK_HEIGHT),
    baseHeight: acceptedHeightArbitrary(MIN_BASE_HEIGHT),
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

  it('accepts _ as the decimal separator, as in PrusaSlicer Klipper labels', () => {
    const decoded = decodeTowerConfigName('temptower_v1_PLA_230to190_step5_h10_5_b1_4_m104_stl')
    expect(decoded?.blockHeight).toBe(10.5)
    expect(decoded?.baseHeight).toBe(1.4)
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
    expect(validateTowerConfig({ ...validBase, blockHeight: config.blockHeight, baseHeight: config.baseHeight })).toEqual([])
    expect(decodeTowerConfigName(`${encodeTowerConfigName(config)}.stl`)).toEqual(config)
  })

  it('round-trips the boundary heights validation accepts', () => {
    for (const blockHeight of [MIN_BLOCK_HEIGHT, 10.001, 6.999, 2 ** 53 / NAME_DECIMAL_SCALE, 1e18]) {
      const config = { ...validBase, blockHeight, baseHeight: 1.234 }
      expect(validateTowerConfig(config)).toEqual([])
      expect(decodeTowerConfigName(`${encodeTowerConfigName(config)}.stl`)).toEqual(config)
    }
  })
})
