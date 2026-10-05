import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GENERIC_ERROR_MESSAGE } from '../apiErrorResponse'

vi.mock('@/lib/auth', () => ({
  verifyAdminSession: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    surveyResponse: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/brackets/service', () => ({
  getBracketFormatRules: vi.fn(),
}))

import { GET as statsGet } from '@/app/api/admin/stats/route'
import { GET as formatRulesGet } from '@/app/api/admin/brackets/format-rules/route'
import { prisma } from '@/lib/prisma'
import { getBracketFormatRules } from '@/lib/brackets/service'

describe('API route JSON error smoke', () => {
  beforeEach(() => {
    vi.mocked(prisma.surveyResponse.findMany).mockReset()
    vi.mocked(getBracketFormatRules).mockReset()
  })

  it('GET /api/admin/stats returns JSON 500 on unexpected errors', async () => {
    vi.mocked(prisma.surveyResponse.findMany).mockRejectedValue(
      new Error('postgres password=secret-internal-detail'),
    )

    const response = await statsGet()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: GENERIC_ERROR_MESSAGE })
    expect(JSON.stringify(body)).not.toContain('secret-internal-detail')
  })

  it('GET /api/admin/brackets/format-rules returns JSON 500 on unexpected errors', async () => {
    vi.mocked(getBracketFormatRules).mockRejectedValue(
      new Error('postgres password=secret-internal-detail'),
    )

    const response = await formatRulesGet()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBeTypeOf('string')
    expect(JSON.stringify(body)).not.toContain('secret-internal-detail')
  })
})
