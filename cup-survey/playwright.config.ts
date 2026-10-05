import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, devices } from '@playwright/test'
import { TOURNAMENT_TIMEZONE } from './lib/config/tournament'

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

if (!process.env.E2E_ADMIN_PASSWORD) {
  process.env.E2E_ADMIN_PASSWORD = 'admin'
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'ru-RU',
    timezoneId: TOURNAMENT_TIMEZONE,
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use system Chrome when Playwright browser download is unavailable.
        channel: 'chrome',
      },
    },
  ],
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  webServer: {
    command: process.env.CI ? 'node scripts/bootstrap-env.mjs && npm run dev' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD ?? 'admin',
      ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
    },
  },
})
