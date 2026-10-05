import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BracketExportError, BracketExportRenderError } from '../errors'
import type { BracketExportCategory } from '../types'

vi.mock('@/lib/auth', () => ({
  verifyAdminSession: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/brackets/export/loadExportCategories', () => ({
  loadBracketExportCategories: vi.fn(),
}))

vi.mock('@/lib/brackets/export/buildBracketPdfDocument', () => ({
  buildBracketPdfDocument: vi.fn(),
}))

import { verifyAdminSession } from '@/lib/auth'
import { GET } from '@/app/api/admin/brackets/export/pdf/route'
import { loadBracketExportCategories } from '@/lib/brackets/export/loadExportCategories'
import { buildBracketPdfDocument } from '@/lib/brackets/export/buildBracketPdfDocument'

function sampleCategory(key: string): BracketExportCategory {
  return {
    categoryKey: key,
    title: key,
    discipline: null,
    matIndex: null,
    competitionStage: 1,
    effectiveSystemId: 'champion',
    participantCount: 1,
    structure: {
      systemId: 'champion',
      systemVersion: 1,
      rounds: [],
      champion: { entryId: 'x', displayName: 'A', clubName: 'C', city: '', publicNumber: 1 },
    },
    participants: [{ entryId: 'x', seedPosition: 1, displayName: 'A', clubName: 'C' }],
    boutOutcomes: {},
    result: null,
  }
}

describe('GET /api/admin/brackets/export/pdf', () => {
  beforeEach(() => {
    vi.mocked(verifyAdminSession).mockResolvedValue(true)
    vi.mocked(loadBracketExportCategories).mockReset()
    vi.mocked(buildBracketPdfDocument).mockReset()
  })

  it('returns pdf when bulk export succeeds', async () => {
    vi.mocked(loadBracketExportCategories).mockResolvedValue([sampleCategory('ok1')])
    vi.mocked(buildBracketPdfDocument).mockResolvedValue(new Uint8Array([37, 80, 68, 70]))

    const response = await GET(new NextRequest('http://localhost/api/admin/brackets/export/pdf'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('returns JSON 500 when render fails', async () => {
    vi.mocked(loadBracketExportCategories).mockResolvedValue([sampleCategory('bad')])
    vi.mocked(buildBracketPdfDocument).mockRejectedValue(
      new BracketExportRenderError('Renderer failed', 'bad'),
    )

    const response = await GET(new NextRequest('http://localhost/api/admin/brackets/export/pdf'))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toMatchObject({ error: 'Renderer failed', categoryKey: 'bad' })
  })

  it('returns JSON 500 when categories fail to load', async () => {
    vi.mocked(loadBracketExportCategories).mockRejectedValue(
      new BracketExportError('Сетка категории «Broken» не сформирована', 500, 'bad'),
    )

    const response = await GET(new NextRequest('http://localhost/api/admin/brackets/export/pdf'))
    expect(response.status).toBe(500)
    expect(response.headers.get('Content-Type')).toContain('application/json')
  })
})
