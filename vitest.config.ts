import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  resolve: {
    // `fixtures/` and `apps/web` tests are not workspace packages, so map the packages to source.
    alias: {
      '@temptower/core': here('./packages/core/src/index.ts'),
      '@temptower/geometry': here('./packages/geometry/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'fixtures/**/*.test.ts', 'apps/web/src/**/*.test.ts'],
    testTimeout: 60_000,
  },
})
