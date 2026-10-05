import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '../../../prisma'
import { bumpRegistrationRevision } from '../../../registration/revision'
import { collectCategoryKeysFromAthletes } from '../../../registration/bracketAutoSync'
import {
  CAT_A,
  createIsolatedDraft,
  ensureBracketDefaults,
  purgeBracketIntegrationState,
  seedPaidEntry,
} from './helpers'

describe('bracket auto-sync on registration change', () => {
  beforeEach(async () => {
    await purgeBracketIntegrationState()
    await ensureBracketDefaults()
  })

  it('adds a paid athlete to the draft bracket for their category', async () => {
    await createIsolatedDraft(BigInt(0))
    const { entryId } = await seedPaidEntry()

    const entry = await prisma.athleteEntry.findUnique({
      where: { id: entryId },
      include: { athlete: { select: { gender: true } } },
    })
    expect(entry).not.toBeNull()

    const categoryKeys = collectCategoryKeysFromAthletes([
      { gender: entry!.athlete.gender, entries: [entry!] },
    ])
    expect(categoryKeys).toContain(CAT_A)

    await bumpRegistrationRevision(categoryKeys)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { categoryKey: CAT_A },
      include: { participants: true },
    })
    expect(draw).not.toBeNull()
    expect(draw!.participants.some((p) => p.entryId === entryId)).toBe(true)

    const draft = await prisma.bracketGeneration.findFirst({ where: { singletonKey: 'live' } })
    expect(draft?.sourceRevision).toBe(BigInt(1))
  })
})
