import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import {
  getDevDatabaseUrl,
  getIntegrationDatabaseUrl,
  getPostgresAdminDatabaseUrl,
  INTEGRATION_TEST_DATABASE_NAME,
} from '../lib/db/integrationDatabaseUrl'

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env')
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

async function withAdminClient<T>(fn: (admin: PrismaClient) => Promise<T>) {
  const adminUrl = getPostgresAdminDatabaseUrl()
  const admin = new PrismaClient({
    datasources: { db: { url: adminUrl } },
  })

  try {
    return await fn(admin)
  } finally {
    await admin.$disconnect()
  }
}

async function recreateIntegrationDatabase() {
  await withAdminClient(async (admin) => {
    await admin.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${INTEGRATION_TEST_DATABASE_NAME}'
        AND pid <> pg_backend_pid()
    `)
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${INTEGRATION_TEST_DATABASE_NAME}"`)
    await admin.$executeRawUnsafe(`CREATE DATABASE "${INTEGRATION_TEST_DATABASE_NAME}"`)
    console.log(`Recreated database ${INTEGRATION_TEST_DATABASE_NAME}`)
  })
}

async function ensureIntegrationDatabaseExists() {
  await withAdminClient(async (admin) => {
    const existing = await admin.$queryRaw<Array<{ datname: string }>>`
      SELECT datname FROM pg_database WHERE datname = ${INTEGRATION_TEST_DATABASE_NAME}
    `

    if (existing.length === 0) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${INTEGRATION_TEST_DATABASE_NAME}"`)
      console.log(`Created database ${INTEGRATION_TEST_DATABASE_NAME}`)
    } else {
      console.log(`Database ${INTEGRATION_TEST_DATABASE_NAME} already exists`)
    }
  })
}

function syncIntegrationSchema(integrationUrl: string) {
  execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: integrationUrl },
  })
}

async function main() {
  loadEnvFile()

  const devUrl = getDevDatabaseUrl()
  const integrationUrl = getIntegrationDatabaseUrl(devUrl)

  const recreate = process.argv.includes('--recreate')
  if (recreate) {
    await recreateIntegrationDatabase()
  } else {
    await ensureIntegrationDatabaseExists()
  }

  try {
    syncIntegrationSchema(integrationUrl)
  } catch (error) {
    console.warn('Schema sync failed, recreating integration database and retrying once…')
    await recreateIntegrationDatabase()
    syncIntegrationSchema(integrationUrl)
  }

  console.log(`Integration test database ready: ${integrationUrl}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
