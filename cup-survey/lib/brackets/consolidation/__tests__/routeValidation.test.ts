import { describe, expect, it, vi } from 'vitest'
import { TEST_CONSOLIDATION_POLICY } from './fixtures'

vi.mock('@/lib/auth', () => ({
  verifyAdminSession: vi.fn().mockResolvedValue(true),
}))

vi.mock('../apply', () => ({
  previewConsolidation: vi.fn().mockResolvedValue({
    ok: true,
    plan: { finalPlacements: [], trace: [], skipped: [], affectedCategoryKeys: [] },
    policy: {
      incompleteThreshold: 1,
      steps: [{ type: 'EXPERIENCE_UP', enabled: true }],
    },
    entries: [],
    consolidationPlanToken: 'token',
    draft: { id: 'gen-1', version: 1 },
  }),
}))

import { POST as previewPost } from '@/app/api/admin/brackets/consolidation/preview/route'
import { POST as applyPost } from '@/app/api/admin/brackets/consolidation/apply/route'

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('consolidation route validation', () => {
  it('preview returns 400 when policy is missing', async () => {
    const response = await previewPost(
      jsonRequest('http://localhost/api/admin/brackets/consolidation/preview', {
        expectedVersion: 1,
      }),
    )

    expect(response.status).toBe(400)
  })

  it('preview returns 400 when all waves are disabled', async () => {
    const response = await previewPost(
      jsonRequest('http://localhost/api/admin/brackets/consolidation/preview', {
        expectedVersion: 1,
        policy: {
          incompleteThreshold: 1,
          steps: [{ type: 'WEIGHT_UP', enabled: false }],
        },
      }),
    )

    expect(response.status).toBe(400)
  })

  it('apply returns 400 when policy is missing', async () => {
    const response = await applyPost(
      jsonRequest('http://localhost/api/admin/brackets/consolidation/apply', {
        expectedVersion: 1,
        consolidationPlanToken: 'token',
      }),
    )

    expect(response.status).toBe(400)
  })

  it('apply returns 400 when all waves are disabled', async () => {
    const response = await applyPost(
      jsonRequest('http://localhost/api/admin/brackets/consolidation/apply', {
        expectedVersion: 1,
        consolidationPlanToken: 'token',
        policy: {
          incompleteThreshold: 1,
          steps: [{ type: 'EXPERIENCE_UP', enabled: false }],
        },
      }),
    )

    expect(response.status).toBe(400)
  })

  it('accepts valid policy shape at route boundary', async () => {
    const response = await previewPost(
      jsonRequest('http://localhost/api/admin/brackets/consolidation/preview', {
        expectedVersion: 1,
        policy: TEST_CONSOLIDATION_POLICY,
      }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
  })
})
