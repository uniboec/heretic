function normalizeDatabaseUrl(url: string): string {
  if (process.platform === 'win32') {
    return url.replace('@localhost:', '@127.0.0.1:')
  }
  return url
}

export const INTEGRATION_TEST_DATABASE_NAME = 'cup_survey_test'

export function getDevDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL
  if (fromEnv) return normalizeDatabaseUrl(fromEnv)

  return 'postgresql://cup_survey:cup_survey@127.0.0.1:5433/cup_survey?schema=public'
}

export function getIntegrationDatabaseUrl(sourceUrl = getDevDatabaseUrl()): string {
  if (process.env.INTEGRATION_DATABASE_URL) {
    return normalizeDatabaseUrl(process.env.INTEGRATION_DATABASE_URL)
  }

  const normalized = normalizeDatabaseUrl(sourceUrl)
  const replaced = normalized.replace(
    /^(postgresql(?:\+\w+)?:\/\/[^/]+\/)([^/?]+)(.*)$/,
    `$1${INTEGRATION_TEST_DATABASE_NAME}$3`,
  )

  if (replaced === normalized) {
    throw new Error(
      `Could not derive integration DATABASE_URL from "${sourceUrl}". Set INTEGRATION_DATABASE_URL explicitly.`,
    )
  }

  return replaced
}

export function getPostgresAdminDatabaseUrl(sourceUrl = getDevDatabaseUrl()): string {
  const normalized = normalizeDatabaseUrl(sourceUrl)
  return normalized.replace(
    /^(postgresql(?:\+\w+)?:\/\/[^/]+\/)([^/?]+)(.*)$/,
    '$1postgres$3',
  )
}

export function getIntegrationDatabaseName(url = process.env.DATABASE_URL ?? ''): string | null {
  const match = url.match(/\/([^/?]+)(?:\?|$)/)
  return match?.[1] ?? null
}

export function isIntegrationTestDatabase(url = process.env.DATABASE_URL ?? ''): boolean {
  return getIntegrationDatabaseName(url) === INTEGRATION_TEST_DATABASE_NAME
}

export function assertIntegrationTestDatabase(url = process.env.DATABASE_URL ?? ''): void {
  if (process.env.BRACKETS_INTEGRATION_TESTS !== '1') {
    throw new Error('Refusing database purge outside integration test runs.')
  }

  if (!isIntegrationTestDatabase(url)) {
    throw new Error(
      `Refusing to purge "${getIntegrationDatabaseName(url) ?? 'unknown'}" — integration tests must use ${INTEGRATION_TEST_DATABASE_NAME}. Run: npm run db:test:prepare`,
    )
  }
}
