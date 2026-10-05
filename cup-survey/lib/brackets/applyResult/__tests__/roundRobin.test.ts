import { describe, expect, it } from 'vitest'
import { patchStructureWithBoutResult } from '../patchPublishedStructure'
import { roundRobinV1Fixtures } from '../../systems/round-robin/v1/fixtures'

describe('round-robin patchStructureWithBoutResult', () => {
  it('stores winner on completed pair', () => {
    const structure = roundRobinV1Fixtures.fourParticipants()
    const pair = structure.roundRobinPairs?.[0]
    expect(pair).toBeDefined()

    const boutId = `cat::rr-${pair!.matchNumber}`
    const { structure: patched, changed } = patchStructureWithBoutResult({
      structure,
      boutId,
      winnerEntryId: pair!.entryIdA,
      loserEntryId: pair!.entryIdB,
      participants: [],
      systemId: 'round_robin',
      bronzeMode: null,
      participantCount: 4,
    })

    expect(changed).toBe(true)
    expect(patched.roundRobinPairs?.[0]?.winnerEntryId).toBe(pair!.entryIdA)
    expect(patched.roundRobinStandings?.find((row) => row.entryId === pair!.entryIdA)?.wins).toBe(1)
  })
})
