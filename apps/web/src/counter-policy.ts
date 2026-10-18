export interface CounterEnvironment {
  readonly isProduction: boolean
  readonly endpoint: string | undefined
}

/**
 * ADR-0001: the anonymous "file processed" event fires only from production
 * builds with a configured https endpoint, never in development or test builds.
 */
export const shouldCount = (environment: CounterEnvironment): boolean =>
  environment.isProduction && typeof environment.endpoint === 'string' && /^https:\/\//.test(environment.endpoint)
