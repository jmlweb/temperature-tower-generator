export const Material = {
  PLA: 'PLA',
  PETG: 'PETG',
  CUSTOM: 'CUSTOM',
} as const
export type Material = (typeof Material)[keyof typeof Material]

/**
 * The single typed tower config shared by geometry and transform (ADR-0005).
 * Tier 0 is the bottom tier and prints at `startTemperature`.
 */
export interface TowerConfig {
  readonly material: Material
  readonly startTemperature: number
  readonly endTemperature: number
  readonly step: number
  readonly blockHeight: number
  readonly baseHeight: number
  readonly waitForTemperature: boolean
}

export interface MaterialPreset {
  readonly material: Material
  readonly label: string
  readonly minTemperature: number
  readonly maxTemperature: number
  readonly config: TowerConfig
}

export const MIN_BLOCK_HEIGHT = 6
export const MIN_BASE_HEIGHT = 1
export const MAX_TIERS = 20
export const Z_EPSILON = 0.001

export const MATERIAL_PRESETS: readonly MaterialPreset[] = [
  {
    material: Material.PLA,
    label: 'PLA',
    minTemperature: 180,
    maxTemperature: 235,
    config: {
      material: Material.PLA,
      startTemperature: 230,
      endTemperature: 190,
      step: 5,
      blockHeight: 10,
      baseHeight: 2,
      waitForTemperature: false,
    },
  },
  {
    material: Material.PETG,
    label: 'PETG',
    minTemperature: 220,
    maxTemperature: 260,
    config: {
      material: Material.PETG,
      startTemperature: 255,
      endTemperature: 225,
      step: 5,
      blockHeight: 10,
      baseHeight: 2,
      waitForTemperature: false,
    },
  },
  {
    material: Material.CUSTOM,
    label: 'Custom',
    minTemperature: 150,
    maxTemperature: 320,
    config: {
      material: Material.CUSTOM,
      startTemperature: 240,
      endTemperature: 200,
      step: 5,
      blockHeight: 10,
      baseHeight: 2,
      waitForTemperature: false,
    },
  },
]

export const findPreset = (material: Material): MaterialPreset => {
  const preset = MATERIAL_PRESETS.find((p) => p.material === material)
  if (!preset) throw new Error(`Unknown material preset: ${material}`)
  return preset
}

export const roundZ = (z: number): number => Math.round(z * 1000) / 1000

export const tierCount = (config: TowerConfig): number =>
  Math.floor(Math.abs(config.endTemperature - config.startTemperature) / config.step + Z_EPSILON) + 1

export const tierTemperature = (config: TowerConfig, tier: number): number => {
  const direction = config.endTemperature >= config.startTemperature ? 1 : -1
  return config.startTemperature + direction * config.step * tier
}

export const tierTemperatures = (config: TowerConfig): readonly number[] =>
  Array.from({ length: tierCount(config) }, (_, i) => tierTemperature(config, i))

/** The only implementation of `b + i·h` (ADR-0005). Tier `i` starts at this Z. */
export const tierBoundaryZ = (config: TowerConfig, tier: number): number =>
  roundZ(config.baseHeight + tier * config.blockHeight)

/** `b + n·h`: the top of the tower. */
export const towerHeight = (config: TowerConfig): number => tierBoundaryZ(config, tierCount(config))

export const validateTowerConfig = (config: TowerConfig): readonly string[] => {
  const problems: string[] = []
  const isFinite = (n: number) => Number.isFinite(n)
  if (!isFinite(config.startTemperature) || config.startTemperature <= 0) problems.push('start temperature must be positive')
  if (!isFinite(config.endTemperature) || config.endTemperature <= 0) problems.push('end temperature must be positive')
  if (!isFinite(config.step) || config.step <= 0) problems.push('step must be positive')
  if (!Number.isInteger(config.startTemperature) || !Number.isInteger(config.endTemperature) || !Number.isInteger(config.step)) {
    problems.push('temperatures and step must be whole degrees')
  }
  if (config.startTemperature === config.endTemperature) problems.push('start and end temperature must differ')
  if (!isFinite(config.blockHeight) || config.blockHeight < MIN_BLOCK_HEIGHT) problems.push(`block height must be at least ${MIN_BLOCK_HEIGHT} mm`)
  if (!isFinite(config.baseHeight) || config.baseHeight < MIN_BASE_HEIGHT) problems.push(`base height must be at least ${MIN_BASE_HEIGHT} mm`)
  if (problems.length === 0 && tierCount(config) > MAX_TIERS) problems.push(`at most ${MAX_TIERS} tiers`)
  if (!(Object.values(Material) as string[]).includes(config.material)) problems.push('unknown material')
  return problems
}
