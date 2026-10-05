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

vi.mock('@/lib/brackets/export/buildBracketWordDocument', () => ({
  buildBracketWordDocument: vi.fn(),
}))

import { verifyAdminSession } from '@/lib/auth'
import { GET } from '@/app/api/admin/brackets/export/word/route'
import { loadBracketExportCategories } from '@/lib/brackets/export/loadExportCategories'
import { buildBracketWordDocument } from '@/lib/brackets/export/buildBracketWordDocument'

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

function exportRequest(url = 'http://localhost/api/admin/brackets/export/word'): NextRequest {
  return new NextRequest(url)
}

describe('GET /api/admin/brackets/export/word', () => {
  beforeEach(() => {
    vi.mocked(verifyAdminSession).mockResolvedValue(true)
    vi.mocked(loadBracketExportCategories).mockReset()
    vi.mocked(buildBracketWordDocument).mockReset()
  })

  it('returns docx when bulk export succeeds', async () => {
    vi.mocked(loadBracketExportCategories).mockResolvedValue([sampleCategory('ok1'), sampleCategory('ok2')])
    vi.mocked(buildBracketWordDocument).mockResolvedValue(Buffer.from('docx-bytes'))

    const response = await GET(exportRequest())
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('wordprocessingml.document')
  })

  it('returns JSON 500 without docx when render fails for one category', async () => {
    vi.mocked(loadBracketExportCategories).mockResolvedValue([
      sampleCategory('ok1'),
      sampleCategory('bad'),
      sampleCategory('ok3'),
    ])
    vi.mocked(buildBracketWordDocument).mockRejectedValue(
      new BracketExportRenderError('Renderer failed', 'bad'),
    )

    const response = await GET(exportRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toMatchObject({ error: 'Renderer failed', categoryKey: 'bad' })
    expect(response.headers.get('Content-Type')).not.toContain('wordprocessingml.document')
  })

  it('returns JSON 500 when ACTIVE category structure is missing during load', async () => {
    vi.mocked(loadBracketExportCategories).mockRejectedValue(
      new BracketExportError('Сетка категории «Broken» не сформирована', 500, 'bad'),
    )

    const response = await GET(exportRequest())
    expect(response.status).toBe(500)
    expect(response.headers.get('Content-Type')).toContain('application/json')
  })
})
