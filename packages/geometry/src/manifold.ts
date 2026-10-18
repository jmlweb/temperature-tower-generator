import Module, { type ManifoldToplevel } from 'manifold-3d'

export type ManifoldModule = ManifoldToplevel

export interface LoadManifoldOptions {
  /** Returns the URL of `manifold.wasm`; needed under bundlers, not under Node. */
  readonly locateFile?: () => string
}

let pending: Promise<ManifoldModule> | null = null

/** Loads the CSG WASM once (ADR-0006: it loads only when a tower is generated). */
export const loadManifold = (options: LoadManifoldOptions = {}): Promise<ManifoldModule> => {
  if (!pending) {
    pending = Module(options.locateFile ? { locateFile: options.locateFile } : undefined).then((wasm) => {
      wasm.setup()
      return wasm
    })
  }
  return pending
}
