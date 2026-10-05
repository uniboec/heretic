import { describe, expect, it } from 'vitest'
import { buildOlympicV1 } from '../../brackets/systems/olympic/v1/build'
import { buildRoundRobinV1 } from '../../brackets/systems/round-robin/v1/build'
import { buildThreeWayV1 } from '../../brackets/systems/three-way/v1/build'
import { extractBouts, type BoutParticipantLookup } from '../extractBouts'
import { groupByEffectiveMatIndex, resolveMatCountForGrouping } from '../groupByEffectiveMatIndex'
import { sortBoutsForSchedule } from '../boutScheduleOrder'
import { sortBouts } from '../sortBouts'
import { toPlayableBouts } from '../toPlayableBouts'
import { toPublicDto } from '../toPublicDto'
import { buildScheduledMats } from '../scheduleService'
import { normalizeBoutsPageSettings } from '../normalizeBoutsPageSettings'
import '../../brackets/systems'

function buildTestSnapshot(matCount: number) {
  return {
    settings: normalizeBoutsPageSettings({
      publicEnabled: true,
      matCount,
      autoMatAssignMode: 'BY_CATEGORY',
      autoMatByCategoryEnabled: true,
    }),
    executions: [],
    scheduleOverrides: {},
  }
}

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

describe('bouts pipeline', () => {
  it('extracts slotSource from olympic structure without matCount', () => {
    const structure = buildOlympicV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const extracted = extractBouts(structure, {
      categoryKey: 'cat:1',
      categoryTitle: 'Category',
      discipline: 'tactic_control',
      storedMatIndex: null,
      competitionStage: 1,
    })
    const withHintSource = extracted.find(
      (bout) => bout.sideA.kind === 'hint' && bout.sideA.source != null,
    )
    expect(withHintSource?.sideA.kind).toBe('hint')
    if (withHintSource?.sideA.kind === 'hint') {
      expect(withHintSource.sideA.source).toEqual({
        matchId: expect.stringMatching(/^bout-\d+$/),
        outcome: 'winner',
      })
    }
  })

  it('assigns globally unique bout ids across categories', () => {
    const structure = buildOlympicV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const catA = extractBouts(structure, {
      categoryKey: 'cat:a',
      categoryTitle: 'A',
      discipline: 'tactic_control',
      storedMatIndex: null,
      competitionStage: 1,
    })
    const catB = extractBouts(structure, {
      categoryKey: 'cat:b',
      categoryTitle: 'B',
      discipline: 'tactic_control',
      storedMatIndex: null,
      competitionStage: 1,
    })
    const ids = [...catA, ...catB].map((bout) => bout.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(catA[0]?.id).toMatch(/^cat:a::bout-/)
  })

  it('includes all assigned mats even when configured matCount is lower', () => {
    const structure = buildThreeWayV1({
      participants: participants.slice(0, 3),
      drawSeed: 'seed',
      options: { bronzeMode: null },
    })
    const extracted = extractBouts(structure, {
      categoryKey: 'cat:3',
      categoryTitle: 'Three way',
      discipline: 'tactic_control',
      storedMatIndex: 3,
      competitionStage: 1,
    })
    expect(resolveMatCountForGrouping(extracted, 1)).toBe(3)

    const grouped = groupByEffectiveMatIndex(extracted, 1)
    expect(grouped.warnings).toHaveLength(0)
    expect(grouped.mats).toHaveLength(3)
    expect(grouped.mats[2]?.bouts.length).toBe(extracted.length)
  })

  it('groups by effective mat index in presentation layer only', () => {
    const structure = buildThreeWayV1({
      participants: participants.slice(0, 3),
      drawSeed: 'seed',
      options: { bronzeMode: null },
    })
    const extracted = extractBouts(structure, {
      categoryKey: 'cat:3',
      categoryTitle: 'Three way',
      discipline: 'tactic_control',
      storedMatIndex: 3,
      competitionStage: 1,
    })
    const playable = toPlayableBouts(extracted, 3)
    const sorted = sortBouts(playable)
    const grouped = groupByEffectiveMatIndex(sorted, 2)

    expect(grouped.warnings).toHaveLength(0)
    expect(grouped.mats).toHaveLength(3)
    expect(grouped.mats[2]?.bouts.length).toBeGreaterThan(0)

    const generatedAt = new Date('2026-01-01T12:00:00.000Z')
    const { mats } = buildScheduledMats({
      grouped,
      snapshot: buildTestSnapshot(2),
      now: generatedAt,
    })
    const dto = toPublicDto({
      published: true,
      publishedAt: generatedAt,
      generatedAt,
      mats,
      scheduleVersion: 0,
      matsEnabled: true,
      scheduleLegacyGap: false,
    })
    expect(dto.published).toBe(true)
    expect(dto.publishedAt).toBe('2026-01-01T12:00:00.000Z')
    expect(dto.mats.length).toBeGreaterThan(0)
  })

  it('schedules final after bronze and earlier-category elimination on one mat', () => {
    const structure = buildOlympicV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const extracted = extractBouts(structure, {
      categoryKey: 'cat:olympic',
      categoryTitle: 'Olympic',
      discipline: 'tactic_control',
      storedMatIndex: 1,
      competitionStage: 1,
    })
    const grouped = groupByEffectiveMatIndex(extracted, 1)
    const { mats } = buildScheduledMats({
      grouped,
      snapshot: buildTestSnapshot(1),
      now: new Date('2026-10-03T05:00:00.000Z'),
    })
    const ordered = sortBoutsForSchedule(extracted)
    const bronzeId = ordered.find((b) => b.schedulePhase === 'bronze')?.id
    const finalId = ordered.find((b) => b.schedulePhase === 'final')?.id
    expect(bronzeId).toBeDefined()
    expect(finalId).toBeDefined()

    const mat1 = mats.find((m) => m.matIndex === 1)
    expect(mat1).toBeDefined()
    const schedule = mat1!.bouts
    const bronzeIndex = schedule.findIndex((b) => b.id === bronzeId)
    const finalIndex = schedule.findIndex((b) => b.id === finalId)
    expect(bronzeIndex).toBeGreaterThan(0)
    expect(finalIndex).toBeGreaterThan(bronzeIndex)

    const bronzeEnd = new Date(schedule[bronzeIndex]!.timing.estimatedEndAt).getTime()
    const finalStart = new Date(schedule[finalIndex]!.timing.estimatedStartAt).getTime()
    expect(finalStart).toBeGreaterThanOrEqual(bronzeEnd)
  })

  it('fills missing propagated elimination athlete names from participant lookup', () => {
    const structure = {
      systemId: 'olympic',
      systemVersion: 1,
      rounds: [
        {
          id: 'bout-1',
          round: 1,
          slot: 1,
          matchNumber: 1,
          participantA: participants[0],
          participantB: participants[1],
        },
        {
          id: 'bout-2',
          round: 2,
          slot: 1,
          matchNumber: 2,
          participantA: {
            entryId: participants[1].entryId,
            seedPosition: participants[1].seedPosition,
            seedLocked: false,
          },
          participantB: null,
          slotSourceB: { matchId: 'bout-3', outcome: 'winner' },
          slotHintB: 'Победитель',
        },
      ],
    }
    const lookup: BoutParticipantLookup = new Map([
      [
        participants[1].entryId,
        {
          displayName: participants[1].displayName,
          clubName: participants[1].clubName,
          city: participants[1].city,
          publicNumber: participants[1].publicNumber,
        },
      ],
    ])
    const extracted = extractBouts(
      structure,
      {
        categoryKey: 'cat:partial',
        categoryTitle: 'Partial propagation',
        discipline: 'close_control',
        storedMatIndex: null,
        competitionStage: 1,
      },
      lookup,
    )
    const bout2 = extracted.find((bout) => bout.id.endsWith('::bout-2'))
    expect(bout2?.sideA).toMatchObject({
      kind: 'athlete',
      entryId: participants[1].entryId,
      displayName: participants[1].displayName,
    })
  })

  it('resolves bronze bout athletes with clubs from hints and lookup', () => {
    const structure = buildOlympicV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const bronzeSlot = structure.bronzeSlots?.[0]
    expect(bronzeSlot).toBeDefined()
    if (!bronzeSlot) return

    const patchedStructure = {
      ...structure,
      bronzeSlots: [
        {
          ...bronzeSlot,
          hintA: participants[2].displayName,
          hintB: participants[3].displayName,
          sourceA: undefined,
          sourceB: undefined,
        },
      ],
    }
    const lookup: BoutParticipantLookup = new Map(
      participants.map((participant) => [
        participant.entryId,
        {
          displayName: participant.displayName,
          clubName: participant.clubName,
          city: participant.city,
          publicNumber: participant.publicNumber,
        },
      ]),
    )
    const extracted = extractBouts(
      patchedStructure,
      {
        categoryKey: 'cat:bronze',
        categoryTitle: 'Bronze clubs',
        discipline: 'close_control',
        storedMatIndex: null,
        competitionStage: 1,
      },
      lookup,
    )
    const bronze = extracted.find((bout) => bout.schedulePhase === 'bronze')
    expect(bronze?.sideA).toMatchObject({
      kind: 'athlete',
      displayName: participants[2].displayName,
      clubName: participants[2].clubName,
    })
    expect(bronze?.sideB).toMatchObject({
      kind: 'athlete',
      displayName: participants[3].displayName,
      clubName: participants[3].clubName,
    })
  })

  it('fills round-robin athlete names from participant lookup', () => {
    const structure = buildRoundRobinV1({
      participants: participants.slice(0, 3),
      drawSeed: 'seed',
      options: { bronzeMode: null },
    })
    const lookup: BoutParticipantLookup = new Map(
      participants.slice(0, 3).map((participant) => [
        participant.entryId,
        {
          displayName: participant.displayName,
          clubName: participant.clubName,
          city: participant.city,
          publicNumber: participant.publicNumber,
        },
      ]),
    )
    const extracted = extractBouts(
      structure,
      {
        categoryKey: 'cat:rr3',
        categoryTitle: 'Round robin 3',
        discipline: 'tactic_control',
        storedMatIndex: null,
        competitionStage: 1,
      },
      lookup,
    )
    const bout3 = extracted.find((bout) => bout.matchNumber === 3)
    expect(bout3?.sideA.kind).toBe('athlete')
    expect(bout3?.sideB.kind).toBe('athlete')
    if (bout3?.sideA.kind === 'athlete' && bout3.sideB.kind === 'athlete') {
      expect(bout3.sideA.displayName).toBeTruthy()
      expect(bout3.sideB.displayName).toBeTruthy()
      expect(bout3.sideA.displayName).not.toBe('Участник')
    }
  })
})
