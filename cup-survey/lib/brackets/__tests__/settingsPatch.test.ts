import { describe, expect, it, vi, beforeEach } from 'vitest'

const draft = {
  id: 'draft-1',
  status: 'DRAFT' as const,
  baseSeed: 'seed',
  sourceRevision: BigInt(1),
  sourceFingerprint: 'source-fp',
  version: 4,
  generatedAt: new Date(),
  publishedAt: null,
}

vi.mock('../../prisma', () => ({
  prisma: {
    bracketPageSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

vi.mock('../live/commitSettingsEligibility', () => ({
  commitSettingsEligibility: vi.fn(),
}))

vi.mock('../dashboardDiff', () => ({
  computeDiffForDraft: vi.fn().mockResolvedValue({ globalCompositionStale: true }),
}))

import { prisma } from '../../prisma'
import { updateBracketSettings } from '../service'
import { commitSettingsEligibility } from '../live/commitSettingsEligibility'

const DEFAULT_PAGE_SETTINGS = {
  id: 'default',
  publicEnabled: false,
  includePaid: true,
  includeUnpaid: false,
  consolidationEnabled: false,
  consolidationPolicy: null,
  migrationPendingVisibleKeys: [] as string[],
  updatedAt: new Date(),
}

describe('PATCH settings invariant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.bracketPageSetting.findUnique).mockResolvedValue(DEFAULT_PAGE_SETTINGS)
    vi.mocked(commitSettingsEligibility).mockResolvedValue({
      ok: true,
      generation: { id: draft.id, version: 5 },
    })
  })

  it('commits eligibility changes through impact-aware path', async () => {
    const result = await updateBracketSettings({
      includeUnpaid: true,
      expectedVersion: draft.version,
      impactToken: 'token',
    })

    expect(result.ok).toBe(true)
    expect(result.settingsStale).toBe(true)
    if (result.ok && 'draft' in result) {
      expect(result.draft?.version).toBe(5)
    }

    expect(commitSettingsEligibility).toHaveBeenCalledWith({
      includePaid: true,
      includeUnpaid: true,
      expectedVersion: draft.version,
      impactToken: 'token',
    })
  })
})
