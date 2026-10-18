import { inspectGcode, loadGcodeFile, processGcode, type Inspection, type LoadedGcode, type ProcessResult, type ReportInput, type TowerConfig } from '@temptower/core'

/** Parsing, decoding and transformation stay off the UI thread (ADR-0002, ADR-0007). */
export type GcodeWorkerRequest =
  | { readonly type: 'inspect'; readonly id: number; readonly fileName: string; readonly bytes: ArrayBuffer }
  | { readonly type: 'process'; readonly id: number; readonly config: TowerConfig }

export type GcodeWorkerResponse =
  | { readonly type: 'inspected'; readonly id: number; readonly inspection: Inspection; readonly input: ReportInput; readonly binaryError: string | null }
  | { readonly type: 'processed'; readonly id: number; readonly result: ProcessResult }
  | { readonly type: 'failed'; readonly id: number; readonly message: string }

let loaded: LoadedGcode | null = null

const reply = (message: GcodeWorkerResponse, transfer: Transferable[] = []): void => self.postMessage(message, transfer)

self.onmessage = (event: MessageEvent<GcodeWorkerRequest>) => {
  const request = event.data
  try {
    if (request.type === 'inspect') {
      loaded = loadGcodeFile({ fileName: request.fileName, bytes: new Uint8Array(request.bytes) })
      reply({
        type: 'inspected',
        id: request.id,
        inspection: inspectGcode(loaded),
        input: { format: loaded.binary || loaded.binaryError !== null ? 'binary' : 'text', binary: loaded.binary?.summary ?? null },
        binaryError: loaded.binaryError,
      })
      return
    }
    if (!loaded) throw new Error('No G-code loaded')
    const result = processGcode({ file: loaded, config: request.config })
    // The output buffer moves to the UI thread instead of being copied; the worker keeps the decoded input for the next transform.
    reply({ type: 'processed', id: request.id, result }, result.outputBytes ? [result.outputBytes.buffer] : [])
  } catch (error) {
    reply({ type: 'failed', id: request.id, message: error instanceof Error ? error.message : String(error) })
  }
}
