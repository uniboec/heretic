import path from 'path'
import { defineConfig, mergeConfig } from 'vitest/config'
import integrationConfig from './vitest.integration.config'

export default mergeConfig(
  integrationConfig,
  defineConfig({
    test: {
      env: {
        BRACKET_DASHBOARD_STAGING_PERF_MS: '500',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  }),
)
