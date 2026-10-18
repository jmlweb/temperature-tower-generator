import { describe, expect, it } from 'vitest'
import { shouldCount } from './counter-policy.ts'

describe('counter policy (ADR-0001)', () => {
  it('never counts in development or test builds', () => {
    expect(shouldCount({ isProduction: false, endpoint: 'https://example.goatcounter.com/count?p=processed' })).toBe(false)
  })

  it('never counts without an https endpoint', () => {
    expect(shouldCount({ isProduction: true, endpoint: undefined })).toBe(false)
    expect(shouldCount({ isProduction: true, endpoint: '' })).toBe(false)
    expect(shouldCount({ isProduction: true, endpoint: 'http://insecure.example/count' })).toBe(false)
  })

  it('counts only in production with an https endpoint', () => {
    expect(shouldCount({ isProduction: true, endpoint: 'https://example.goatcounter.com/count?p=processed' })).toBe(true)
  })
})
