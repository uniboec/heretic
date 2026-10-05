import { describe, expect, it } from 'vitest'
import { readPublishedStructure } from '../../brackets/core/readPublishedStructure'
import { serializePublishedStructure } from '../../brackets/core/snapshot'
import type { BracketStructure } from '../../brackets/core/types'
import { buildOlympicV1 } from '../../brackets/systems/olympic/v1/build'
import { extractBouts } from '../extractBouts'
import { toPlayableBouts } from '../toPlayableBouts'
import '../../brackets/systems'

const participants = [
  {
    entryId: 'e1',
    displayName: 'Athlete 1',
    clubName: 'Club A',
    city: 'City',
    clubIdentity: 'club-a',
    publicNumber: 1,
    seedPosition: 1,
    seedLocked: false,
  },
  {
    entryId: 'e2',
    displayName: 'Athlete 2',
    clubName: 'Club B',
    city: 'City',
    clubIdentity: 'club-b',
    publicNumber: 2,
    seedPosition: 2,
    seedLocked: false,
  },
  {
    entryId: 'e3',
    displayName: 'Athlete 3',
    clubName: 'Club C',
    city: 'City',
    clubIdentity: 'club-c',
    publicNumber: 3,
    seedPosition: 3,
    seedLocked: false,
  },
  {
    entryId: 'e4',
    displayName: 'Athlete 4',
    clubName: 'Club D',
    city: 'City',
    clubIdentity: 'club-d',
    publicNumber: 4,
    seedPosition: 4,
    seedLocked: false,
  },
]

const categoryMeta = {
  categoryKey: 'cat:test',
  categoryTitle: 'Test category',
  discipline: 'tactic_control',
  storedMatIndex: null as number | null,
}

function stripSlotSources(structure: BracketStructure): BracketStructure {
  return {
    ...structure,
    rounds: structure.rounds.map((round) => ({
      ...round,
      slotSourceA: undefined,
      slotSourceB: undefined,
    })),
    bronzeSlots: structure.bronzeSlots?.map((slot) => ({
      ...slot,
      sourceA: undefined,
      sourceB: undefined,
    })),
  }
}

describe('bouts legacy read path', () => {
  it('Legacy A: label-only hints deserialize and extract without slotSource', () => {
    const built = buildOlympicV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const legacyStructure = stripSlotSources(built)
    const snapshot = serializePublishedStructure({
      systemId: built.systemId,
      systemVersion: built.systemVersion,
      structure: legacyStructure,
    })

    const deserialized = readPublishedStructure({
      publishedStructureJson: snapshot,
      autoSystemId: 'olympic',
      systemOverride: null,
      systemVersion: 1,
      autoBronzeMode: 'ONE',
      bronzeModeOverride: null,
      drawSeed: 'seed',
      participants: participants.map((participant, index) => ({
        id: `p-${index}`,
        drawId: 'draw-1',
        entryId: participant.entryId,
        seedPosition: participant.seedPosition,
        seedLocked: false,
        snapshotDisplayName: participant.displayName,
        snapshotClubName: participant.clubName,
        snapshotCity: participant.city,
        snapshotPublicNumber: participant.publicNumber,
      })),
      effectiveBronzeMode: 'ONE',
    })

    expect(deserialized).not.toBeNull()
    const extracted = extractBouts(deserialized!, categoryMeta)
    const hintSide = extracted.flatMap((bout) => [bout.sideA, bout.sideB]).find((side) => side.kind === 'hint')
    expect(hintSide?.kind).toBe('hint')
    if (hintSide?.kind === 'hint') {
      expect(hintSide.label.length).toBeGreaterThan(0)
      expect(hintSide.source).toBeUndefined()
    }
  })

  it('Legacy B: null publishedStructureJson rebuilds and yields playable bouts', () => {
    const rebuilt = readPublishedStructure({
      publishedStructureJson: null,
      autoSystemId: 'olympic',
      systemOverride: null,
      systemVersion: 1,
      autoBronzeMode: null,
      bronzeModeOverride: null,
      drawSeed: 'seed',
      participants: participants.map((participant, index) => ({
        id: `p-${index}`,
        drawId: 'draw-1',
        entryId: participant.entryId,
        seedPosition: participant.seedPosition,
        seedLocked: false,
        snapshotDisplayName: participant.displayName,
        snapshotClubName: participant.clubName,
        snapshotCity: participant.city,
        snapshotPublicNumber: participant.publicNumber,
      })),
      effectiveBronzeMode: null,
    })

    expect(rebuilt).not.toBeNull()
    const extracted = extractBouts(rebuilt!, categoryMeta)
    const playable = toPlayableBouts(extracted, participants.length)
    expect(playable.length).toBeGreaterThan(0)
  })
})
