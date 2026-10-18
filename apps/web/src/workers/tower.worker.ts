import type { TowerConfig } from '@temptower/core'
import wasmUrl from 'manifold-3d/manifold.wasm?url'

export interface TowerWorkerRequest {
  readonly type: 'build'
  readonly id: number
  readonly config: TowerConfig
}

export type TowerWorkerResponse =
  | { readonly type: 'built'; readonly id: number; readonly fileName: string; readonly stl: ArrayBuffer; readonly triangles: number }
  | { readonly type: 'failed'; readonly id: number; readonly message: string }

self.onmessage = async (event: MessageEvent<TowerWorkerRequest>) => {
  const { id, config } = event.data
  try {
    // The CSG WASM loads only when a tower is generated (ADR-0006).
    const geometry = await import('@temptower/geometry')
    const wasm = await geometry.loadManifold({ locateFile: () => wasmUrl })
    const tower = geometry.buildTower(wasm, config)
    const stl = geometry.writeBinaryStl(tower.mesh, geometry.towerFileName(config))
    const response: TowerWorkerResponse = {
      type: 'built',
      id,
      fileName: geometry.towerFileName(config),
      stl: stl.buffer as ArrayBuffer,
      triangles: tower.mesh.triangles.length / 3,
    }
    self.postMessage(response, [response.stl])
  } catch (error) {
    const response: TowerWorkerResponse = { type: 'failed', id, message: error instanceof Error ? error.message : String(error) }
    self.postMessage(response)
  }
}
