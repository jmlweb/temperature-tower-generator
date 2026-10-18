import { decodeTowerConfigName } from './filename-codec.ts'
import type { TowerConfig } from './tower-config.ts'

export const ConfigSource = {
  FILENAME: 'filename',
  OBJECT_LABEL: 'object-label',
  MANUAL: 'manual',
} as const
export type ConfigSource = (typeof ConfigSource)[keyof typeof ConfigSource]

export interface RecoveredConfig {
  readonly config: TowerConfig
  readonly source: ConfigSource
}

/**
 * Recovery order (ADR-0005): the G-code file name, then the object name in the
 * object-label comments. Null means the UI falls back to manual entry.
 */
export const recoverTowerConfig = (fileName: string, objectNames: readonly string[]): RecoveredConfig | null => {
  const fromName = decodeTowerConfigName(fileName)
  if (fromName) return { config: fromName, source: ConfigSource.FILENAME }
  for (const objectName of objectNames) {
    const fromLabel = decodeTowerConfigName(objectName)
    if (fromLabel) return { config: fromLabel, source: ConfigSource.OBJECT_LABEL }
  }
  return null
}
