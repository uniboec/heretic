/**
 * §11 perf: dashboard-lite should stay fast without structure payloads.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { getAdminBracketsDashboard } from '../../service'
import {
  cleanupBracketIntegrationData,
  prepareLargeDashboardDraft,
  preparePublishableDraft,
  resetRegistrationRevision,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('admin dashboard-lite performance', () => {
  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  useIntegrationDb()

  afterEach(async () => {
    if (!dbAvailable) return
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    generationIds.length = 0
    registrationIds.length = 0
    entryIds.length = 0
    await resetRegistrationRevision()
  })

  it('completes within CI-safe budget for a typical draft', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const started = performance.now()
    const dashboard = await getAdminBracketsDashboard()
    const elapsedMs = performance.now() - started

    expect(dashboard.draft).toBeTruthy()
    expect(dashboard.categories.length).toBeGreaterThan(0)
    expect(dashboard.categories.every((category) => !('structure' in category))).toBe(true)

    const budgetMs = Number(process.env.BRACKET_DASHBOARD_PERF_MS ?? 2000)
    expect(elapsedMs).toBeLessThan(budgetMs)
  })

  it(
    'completes within staging budget for 50 categories without structure',
    async () => {
      const prepared = await prepareLargeDashboardDraft(50)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)
      generationIds.push(prepared.originalDraftId)

      const started = performance.now()
      const dashboard = await getAdminBracketsDashboard()
      const elapsedMs = performance.now() - started

      expect(dashboard.categories.length).toBeGreaterThanOrEqual(50)
      expect(dashboard.categories.every((category) => !('structure' in category))).toBe(true)

      const budgetMs = Number(process.env.BRACKET_DASHBOARD_STAGING_PERF_MS ?? 1000)
      expect(elapsedMs).toBeLessThan(budgetMs)
    },
    120_000,
  )
})
