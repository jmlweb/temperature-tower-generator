import { inspectGcode, isBinaryGcode, processGcode, type Inspection, type ProcessResult, type TowerConfig } from '@temptower/core'

/** Parsing and transformation stay off the UI thread (ADR-0002). */
export type GcodeWorkerRequest =
  | { readonly type: 'inspect'; readonly id: number; readonly fileName: string; readonly bytes: ArrayBuffer }
  | { readonly type: 'process'; readonly id: number; readonly config: TowerConfig }

export type GcodeWorkerResponse =
  | { readonly type: 'inspected'; readonly id: number; readonly inspection: Inspection; readonly isBinary: boolean }
  | { readonly type: 'processed'; readonly id: number; readonly result: ProcessResult }
  | { readonly type: 'failed'; readonly id: number; readonly message: string }

interface LoadedFile {
  readonly fileName: string
  readonly text: string
  readonly isBinary: boolean
}

let loaded: LoadedFile | null = null

const reply = (message: GcodeWorkerResponse): void => self.postMessage(message)

self.onmessage = (event: MessageEvent<GcodeWorkerRequest>) => {
  const request = event.data
  try {
    if (request.type === 'inspect') {
      const bytes = new Uint8Array(request.bytes)
      const isBinary = isBinaryGcode(bytes, request.fileName)
      const text = isBinary ? '' : new TextDecoder('utf-8').decode(bytes)
      loaded = { fileName: request.fileName, text, isBinary }
      reply({ type: 'inspected', id: request.id, inspection: inspectGcode({ fileName: request.fileName, text }), isBinary })
      return
    }
    if (!loaded) throw new Error('No G-code loaded')
    const result = processGcode({ fileName: loaded.fileName, text: loaded.text, config: request.config, isBinary: loaded.isBinary })
    reply({ type: 'processed', id: request.id, result })
  } catch (error) {
    reply({ type: 'failed', id: request.id, message: error instanceof Error ? error.message : String(error) })
  }
}
