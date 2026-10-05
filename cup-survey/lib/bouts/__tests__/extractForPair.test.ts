import { describe, expect, it } from 'vitest'
import { extractPlayableBoutsForPair } from '../extractForPair'
import type { BracketCategoryStatus } from '../../brackets/core/types'
import type { PublishedDrawPair, PublishedDrawWithRelations } from '../../brackets/generation/publishedDraws'

function buildPair(input: {
  status: BracketCategoryStatus
  autoSystemId: string | null
  participantCount: number
}): PublishedDrawPair {
  const participants = Array.from({ length: input.participantCount }, (_, index) => ({
    id: `participant-${index}`,
    drawId: 'draw-1',
    entryId: `entry-${index}`,
    seedPosition: index + 1,
    seedLocked: false,
    snapshotDisplayName: `Athlete ${index + 1}`,
    snapshotClubName: 'Club',
    snapshotCity: 'City',
    snapshotPublicNumber: index + 1,
  }))

  return {
    publicationState: {
      id: 'pub-1',
      categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
      visible: true,
      boutsReleased: false,
      boutMatAssignments: null,
      matCountAtRelease: null,
      publishedDrawId: 'draw-1',
      updatedAt: new Date(),
    },
    draw: {
      id: 'draw-1',
      generationId: 'gen-1',
      categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
      discipline: 'tactic_control',
      title: 'Test category',
      status: input.status,
      autoSystemId: input.autoSystemId,
      systemOverride: null,
      systemVersion: 1,
      autoBronzeMode: null,
      bronzeModeOverride: null,
      drawSeed: 'seed',
      redrawRevision: 0,
      seedingFingerprint: null,
      drawInputFingerprint: null,
      sourceFingerprint: null,
      matIndex: null,
      publishedStructureJson: null,
      updatedAt: new Date(),
      generation: {
        id: 'gen-1',
        status: 'ACTIVE',
        singletonKey: 'live',
        baseSeed: 'base',
        version: 1,
        sourceRevision: BigInt(0),
        sourceFingerprint: null,
        generatedAt: new Date(),
        publishedAt: new Date(),
      },
      participants,
    } as PublishedDrawWithRelations,
  }
}

describe('extractPlayableBoutsForPair', () => {
  it('returns no bouts for champion categories', () => {
    const bouts = extractPlayableBoutsForPair(
      buildPair({ status: 'ACTIVE', autoSystemId: 'champion', participantCount: 1 }),
    )
    expect(bouts).toEqual([])
  })

  it('returns no bouts for singleton olympic categories', () => {
    const bouts = extractPlayableBoutsForPair(
      buildPair({ status: 'ACTIVE', autoSystemId: 'olympic', participantCount: 1 }),
    )
    expect(bouts).toEqual([])
  })

  it('returns no bouts for inactive categories', () => {
    const bouts = extractPlayableBoutsForPair(
      buildPair({ status: 'INACTIVE', autoSystemId: 'olympic', participantCount: 2 }),
    )
    expect(bouts).toEqual([])
  })
})
