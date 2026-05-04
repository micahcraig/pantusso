import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['node_modules', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'components/**/*.ts', 'app/api/**/*.ts'],
      exclude: ['**/*.test.ts', 'app/api/auth/**'],
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
