import { describe, expect, it } from 'vitest'
import {
  getIntegrationDatabaseUrl,
  isIntegrationTestDatabase,
} from '../integrationDatabaseUrl'

describe('integrationDatabaseUrl', () => {
  it('derives cup_survey_test from dev DATABASE_URL', () => {
    expect(
      getIntegrationDatabaseUrl(
        'postgresql://cup_survey:cup_survey@127.0.0.1:5433/cup_survey?schema=public',
      ),
    ).toBe('postgresql://cup_survey:cup_survey@127.0.0.1:5433/cup_survey_test?schema=public')
  })

  it('detects integration test database name', () => {
    expect(
      isIntegrationTestDatabase(
        'postgresql://cup_survey:cup_survey@127.0.0.1:5433/cup_survey_test?schema=public',
      ),
    ).toBe(true)
    expect(
      isIntegrationTestDatabase(
        'postgresql://cup_survey:cup_survey@127.0.0.1:5433/cup_survey?schema=public',
      ),
    ).toBe(false)
  })
})
