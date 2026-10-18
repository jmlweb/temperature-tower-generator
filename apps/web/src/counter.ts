import { shouldCount } from './counter-policy.ts'

export interface Counter {
  /** Records one anonymous "file processed" event. Called once per download click. */
  recordProcessed(): void
}

/**
 * Cookieless image beacon to the third-party counter (ADR-0001). The request
 * carries no file contents, file names or tower config: only the fixed URL.
 */
export const createCounter = (environment: { isProduction: boolean; endpoint: string | undefined }): Counter => {
  const endpoint = environment.endpoint
  if (!shouldCount(environment) || endpoint === undefined) return { recordProcessed: () => undefined }
  return {
    recordProcessed: () => {
      const beacon = new Image(1, 1)
      beacon.referrerPolicy = 'no-referrer'
      beacon.src = `${endpoint}${endpoint.includes('?') ? '&' : '?'}rnd=${Date.now()}`
    },
  }
}
