import { describe, expect, it } from 'vitest'
import { buildOlympicV1 } from '../systems/olympic/v1/build'
import { buildRoundRobinV1 } from '../systems/round-robin/v1/build'
import '../systems'
import { buildBracketBoutId } from '../buildBracketBoutId'
import { extractBouts } from '../../bouts/extractBouts'

const categoryKey = 'tactic_control:experienced:m_boys_2:m_boys_2_w_le_20'

const categoryMeta = {
  categoryKey,
  categoryTitle: 'Test category',
  discipline: 'tactic_control',
  storedMatIndex: 1,
  competitionStage: 1,
}

const participants = Array.from({ length: 4 }, (_, index) => ({
  entryId: `e${index + 1}`,
  displayName: `Athlete ${index + 1}`,
  clubName: 'Club',
  city: 'City',
  clubIdentity: `club-${index}`,
  publicNumber: index + 1,
  seedPosition: index + 1,
  seedLocked: false,
}))

describe('buildBracketBoutId', () => {
  it('matches extractBouts ids for olympic matches and bronze', () => {
    const structure = buildOlympicV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const bouts = extractBouts(structure, categoryMeta)

    for (const match of structure.rounds) {
      expect(buildBracketBoutId(categoryKey, match.id)).toBe(
        bouts.find((bout) => bout.id.endsWith(`::${match.id}`))?.id,
      )
    }

    const bronze = structure.bronzeSlots?.[0]
    expect(bronze).toBeTruthy()
    expect(buildBracketBoutId(categoryKey, bronze!.id)).toBe(
      bouts.find((bout) => bout.schedulePhase === 'bronze')?.id,
    )
  })

  it('matches extractBouts ids for round-robin pairs', () => {
    const structure = buildRoundRobinV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: null },
    })

    const bouts = extractBouts(structure, categoryMeta)
    for (const pair of structure.roundRobinPairs ?? []) {
      const localId = `rr-${pair.matchNumber}`
      expect(buildBracketBoutId(categoryKey, localId)).toBe(
        bouts.find((bout) => bout.id.endsWith(`::${localId}`))?.id,
      )
    }
  })
})
