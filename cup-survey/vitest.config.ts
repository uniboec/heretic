import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'components/**/__tests__/**/*.test.ts'],
    exclude: ['lib/**/*.integration.test.ts'],
    env: {
      CUP_SURVEY_SCRIPT_MODE: '1',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'server-only': path.resolve(__dirname, 'vitest-server-only-stub.ts'),
    },
  },
})
