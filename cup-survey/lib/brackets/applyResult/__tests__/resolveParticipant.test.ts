import { describe, expect, it } from 'vitest'
import type { BracketDrawParticipant } from '@prisma/client'
import { findDrawParticipant, toBracketParticipantInput } from '../resolveParticipant'

function makeParticipant(
  overrides: Partial<BracketDrawParticipant> = {},
): BracketDrawParticipant {
  return {
    id: 'participant-1',
    drawId: 'draw-1',
    entryId: 'entry-1',
    seedPosition: 1,
    seedLocked: false,
    snapshotDisplayName: 'Иванов Иван',
    snapshotClubName: 'Клуб',
    snapshotCity: 'Город',
    snapshotPublicNumber: 7,
    ...overrides,
  }
}

describe('resolveParticipant', () => {
  it('maps draw participant snapshots into bracket participant input', () => {
    expect(toBracketParticipantInput(makeParticipant())).toEqual({
      entryId: 'entry-1',
      displayName: 'Иванов Иван',
      clubName: 'Клуб',
      city: 'Город',
      clubIdentity: 'Клуб::Город',
      publicNumber: 7,
      seedPosition: 1,
      seedLocked: false,
      strengthTier: null,
      clubKey: null,
      cityKey: null,
    })
  })

  it('falls back to entryId when snapshot display name is missing', () => {
    expect(
      toBracketParticipantInput(
        makeParticipant({
          snapshotDisplayName: null,
          snapshotClubName: null,
          snapshotCity: null,
          snapshotPublicNumber: null,
        }),
      ).displayName,
    ).toBe('entry-1')
  })

  it('finds participant by entry id', () => {
    const participant = findDrawParticipant([makeParticipant()], 'entry-1')
    expect(participant?.displayName).toBe('Иванов Иван')
  })
})
