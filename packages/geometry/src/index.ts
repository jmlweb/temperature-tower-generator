import { encodeTowerConfigName, type TowerConfig } from '@temptower/core'

export { loadManifold, type LoadManifoldOptions, type ManifoldModule } from './manifold.ts'
export { buildTower, TOWER_DIMENSIONS, TOWER_WIDTH, type TowerMesh, type TowerLabel, type TriangleMesh } from './tower.ts'
export { writeBinaryStl, readBinaryStl } from './stl.ts'
export { isManifold, meshBounds, meshHeight, readLabel } from './mesh-checks.ts'
export { textBitmap, textCells, textColumns, GLYPH_ROWS, GLYPH_COLUMNS } from './font.ts'

/** The STL base name encodes the config (ADR-0005). */
export const towerFileName = (config: TowerConfig): string => `${encodeTowerConfigName(config)}.stl`
