import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  verifyAdminSession: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/brackets/export/buildBracketWordFromImages', () => ({
  buildBracketWordFromImages: vi.fn(),
}))

import { verifyAdminSession } from '@/lib/auth'
import { POST } from '@/app/api/admin/brackets/export/word/images/route'
import { buildBracketWordFromImages } from '@/lib/brackets/export/buildBracketWordFromImages'

const tinyPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('POST /api/admin/brackets/export/word/images', () => {
  beforeEach(() => {
    vi.mocked(verifyAdminSession).mockResolvedValue(true)
    vi.mocked(buildBracketWordFromImages).mockReset()
  })

  it('returns docx when image payload is valid', async () => {
    vi.mocked(buildBracketWordFromImages).mockResolvedValue(Buffer.from('docx-bytes'))

    const response = await POST(
      new NextRequest('http://localhost/api/admin/brackets/export/word/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: [
            {
              title: 'Категория A',
              meta: 'TC · 8 участников',
              orientation: 'landscape',
              pngBase64: tinyPngBase64,
            },
          ],
        }),
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('wordprocessingml.document')
  })

  it('returns 400 when sections are missing', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/admin/brackets/export/word/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: [] }),
      }),
    )

    expect(response.status).toBe(400)
  })

  it('requires auth', async () => {
    vi.mocked(verifyAdminSession).mockResolvedValue(false)

    const response = await POST(
      new NextRequest('http://localhost/api/admin/brackets/export/word/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: [
            {
              title: 'A',
              meta: 'meta',
              orientation: 'portrait',
              pngBase64: tinyPngBase64,
            },
          ],
        }),
      }),
    )

    expect(response.status).toBe(401)
  })
})
