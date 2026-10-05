import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import { getDevDatabaseUrl, getIntegrationDatabaseUrl } from './lib/db/integrationDatabaseUrl'

function loadEnvFile() {
  const envPath = resolve(__dirname, '.env')
  if (!existsSync(envPath)) return

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadEnvFile()

const integrationDatabaseUrl = getIntegrationDatabaseUrl(
  process.env.DATABASE_URL ?? getDevDatabaseUrl(),
)

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'lib/brackets/__tests__/integration/**/*.integration.test.ts',
      'lib/bouts/__tests__/**/*.integration.test.ts',
      'lib/registration/__tests__/**/*.integration.test.ts',
      'lib/awards/__tests__/integration/**/*.integration.test.ts',
      'lib/announcer/__tests__/integration/**/*.integration.test.ts',
      'lib/athleteRatings/__tests__/integration/**/*.integration.test.ts',
    ],
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 30000,
    env: {
      BRACKETS_INTEGRATION_TESTS: '1',
      REGISTRATION_INTEGRATION_TESTS: '1',
      ANNOUNCER_INTEGRATION_TESTS: '1',
      DATABASE_URL: integrationDatabaseUrl,
      BRACKETS_ACTIVE_ONLY: 'true',
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
