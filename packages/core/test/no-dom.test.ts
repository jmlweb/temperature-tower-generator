import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FORBIDDEN = /\b(window|document|Blob|Worker|navigator|localStorage|fetch|TextDecoder|FileReader)\b/

/** ADR-0002: packages/core imports no DOM or browser-only API. */
describe('core has no DOM dependency', () => {
  it('uses no browser-only globals in source files', () => {
    const dir = join(import.meta.dirname, '..', 'src')
    const sources = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    expect(sources.length).toBeGreaterThan(5)
    for (const name of sources) {
      const text = readFileSync(join(dir, name), 'utf8')
      expect(text, name).not.toMatch(FORBIDDEN)
    }
  })
})
