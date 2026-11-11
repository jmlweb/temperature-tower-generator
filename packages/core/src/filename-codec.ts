import { Material, type TowerConfig } from './tower-config.ts'

/**
 * Versioned, reversible STL base name (ADR-0005), e.g.
 * `temptower_v1_PLA_230to190_step5_h10_b2_m104`.
 * Changing this format needs a new version marker.
 */
export const FILENAME_VERSION = 'v1'
const PREFIX = `temptower_${FILENAME_VERSION}`

const formatNumber = (n: number): string => String(Math.round(n * 1000) / 1000)

export const encodeTowerConfigName = (config: TowerConfig): string =>
  [
    PREFIX,
    config.material,
    `${formatNumber(config.startTemperature)}to${formatNumber(config.endTemperature)}`,
    `step${formatNumber(config.step)}`,
    `h${formatNumber(config.blockHeight)}`,
    `b${formatNumber(config.baseHeight)}`,
    config.waitForTemperature ? 'm109' : 'm104',
  ].join('_')

// PrusaSlicer writes Klipper object labels with `.` replaced by `_`, so `b1.4` arrives as `b1_4` (RPT-009). Decode only.
const NUMBER = String.raw`\d+(?:[._]\d+)?`
const toNumber = (value: string | undefined): number => Number(value?.replace('_', '.'))
const PATTERN = new RegExp(
  `${PREFIX}_(PLAPLUS|PLASILK|PLA|PETG|ABS|ASA|TPU|HIPS|PA|PC|CUSTOM)_(${NUMBER})to(${NUMBER})_step(${NUMBER})_h(${NUMBER})_b(${NUMBER})_(m104|m109)`,
)

/** Finds an encoded config anywhere in `name` (slicers append suffixes), or returns null. */
export const decodeTowerConfigName = (name: string): TowerConfig | null => {
  const match = PATTERN.exec(name)
  if (!match) return null
  const [, material, start, end, step, blockHeight, baseHeight, mode] = match
  return {
    material: material as Material,
    startTemperature: toNumber(start),
    endTemperature: toNumber(end),
    step: toNumber(step),
    blockHeight: toNumber(blockHeight),
    baseHeight: toNumber(baseHeight),
    waitForTemperature: mode === 'm109',
  }
}
