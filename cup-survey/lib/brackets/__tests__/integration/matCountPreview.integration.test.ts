import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../../prisma'
import {
  CAT_A,
  createIsolatedDraft,
  ensureBracketDefaults,
  purgeBracketIntegrationState,
  seedBoutsPageSetting,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

vi.mock('@/lib/auth', () => ({
  verifyAdminSession: vi.fn().mockResolvedValue(true),
}))

import { GET as matCountPreviewGet } from '@/app/api/admin/bouts/settings/mat-count-preview/route'
import { PATCH as boutsSettingsPatch } from '@/app/api/admin/bouts/settings/route'

describe('mat count preview route integration', () => {
  useIntegrationDb()

  beforeEach(async () => {
    if (!dbAvailable) return
    await purgeBracketIntegrationState()
    await ensureBracketDefaults()
    await seedBoutsPageSetting({ matCount: 3 })
  })

  it('preview then PATCH without confirm returns 409 demotion', async () => {
    const draft = await createIsolatedDraft(BigInt(0))
    await prisma.bracketCategoryDraw.create({
      data: {
        generationId: draft.id,
        categoryKey: CAT_A,
        discipline: 'tactic_control',
        title: 'Test',
        drawSeed: 'seed',
        matIndex: 3,
      },
    })

    const previewUrl = new URL('http://localhost/api/admin/bouts/settings/mat-count-preview')
    previewUrl.searchParams.set('matCount', '2')
    previewUrl.searchParams.set('draftId', draft.id)
    previewUrl.searchParams.set('expectedVersion', String(draft.version))

    const previewResponse = await matCountPreviewGet(new Request(previewUrl.toString()))
    expect(previewResponse.status).toBe(200)
    const preview = await previewResponse.json()
    expect(preview.needsConfirmation).toBe(true)
    expect(typeof preview.demotionToken).toBe('string')

    const patchResponse = await boutsSettingsPatch(
      new Request('http://localhost/api/admin/bouts/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matCount: 2,
          draftId: draft.id,
          expectedVersion: draft.version,
        }),
      }),
    )
    expect(patchResponse.status).toBe(409)
    const patchBody = await patchResponse.json()
    expect(patchBody.code).toBe('MAT_COUNT_DEMOTION_CONFIRMATION_REQUIRED')
    expect(patchBody.error).toBe('Требуется подтверждение перевода Fixed-категорий в Auto')
    expect(typeof patchBody.demotionToken).toBe('string')
  })
})
