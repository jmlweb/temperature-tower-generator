import type { Inspection, ProcessResult, ReportInput, TowerConfig } from '@temptower/core'
import type { GcodeWorkerRequest, GcodeWorkerResponse } from './workers/gcode.worker.ts'
import type { TowerWorkerRequest, TowerWorkerResponse } from './workers/tower.worker.ts'

type Pending<T> = { resolve: (value: T) => void; reject: (reason: Error) => void }

/** `Omit` over a union must distribute, or the request variants collapse into their common keys. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** Promise wrapper over a worker that answers each request `id` exactly once. */
const createRequestChannel = <Request extends { id: number }, Response extends { id: number; type: string }>(worker: Worker) => {
  const pending = new Map<number, Pending<Response>>()
  let nextId = 1
  worker.onmessage = (event: MessageEvent<Response>) => {
    const entry = pending.get(event.data.id)
    if (!entry) return
    pending.delete(event.data.id)
    if (event.data.type === 'failed') entry.reject(new Error((event.data as { message?: string }).message ?? 'Worker failed'))
    else entry.resolve(event.data)
  }
  worker.onerror = (event) => {
    for (const entry of pending.values()) entry.reject(new Error(event.message))
    pending.clear()
  }
  return (request: DistributiveOmit<Request, 'id'>, transfer: Transferable[] = []): Promise<Response> =>
    new Promise((resolve, reject) => {
      const id = nextId
      nextId += 1
      pending.set(id, { resolve, reject })
      worker.postMessage({ ...request, id }, transfer)
    })
}

export interface InspectResult {
  readonly inspection: Inspection
  readonly input: ReportInput
  /** Why a binary file could not be decoded (ADR-0007), or null. */
  readonly binaryError: string | null
}

export interface GcodeClient {
  inspect(fileName: string, bytes: ArrayBuffer): Promise<InspectResult>
  process(config: TowerConfig): Promise<ProcessResult>
}

export const createGcodeClient = (): GcodeClient => {
  const worker = new Worker(new URL('./workers/gcode.worker.ts', import.meta.url), { type: 'module' })
  const send = createRequestChannel<GcodeWorkerRequest, GcodeWorkerResponse>(worker)
  return {
    inspect: async (fileName, bytes) => {
      const response = await send({ type: 'inspect', fileName, bytes }, [bytes])
      if (response.type !== 'inspected') throw new Error('Unexpected worker response')
      return { inspection: response.inspection, input: response.input, binaryError: response.binaryError }
    },
    process: async (config) => {
      const response = await send({ type: 'process', config })
      if (response.type !== 'processed') throw new Error('Unexpected worker response')
      return response.result
    },
  }
}

export interface TowerClient {
  build(config: TowerConfig): Promise<{ fileName: string; stl: ArrayBuffer; triangles: number }>
}

export const createTowerClient = (): TowerClient => {
  const worker = new Worker(new URL('./workers/tower.worker.ts', import.meta.url), { type: 'module' })
  const send = createRequestChannel<TowerWorkerRequest, TowerWorkerResponse>(worker)
  return {
    build: async (config) => {
      const response = await send({ type: 'build', config })
      if (response.type !== 'built') throw new Error('Unexpected worker response')
      return { fileName: response.fileName, stl: response.stl, triangles: response.triangles }
    },
  }
}
