import { describe, expect, it } from 'vitest'
import {
  compactSeedPositions,
  validateParticipantSeedUpdates,
  validateSeedPositions,
} from '../core/seeding/validateSeeds'

describe('validateSeeds', () => {
  it('compacts gaps and out-of-range positions to 1..N', () => {
    const compacted = compactSeedPositions([
      { entryId: 'a', seedPosition: 1 },
      { entryId: 'b', seedPosition: 3 },
      { entryId: 'c', seedPosition: 16 },
    ])

    expect(compacted.map((item) => item.seedPosition)).toEqual([1, 2, 3])
    expect(compacted.map((item) => item.entryId)).toEqual(['a', 'b', 'c'])
  })

  it('rejects seed positions outside 1..N', () => {
    expect(validateSeedPositions([1, 2, 15, 16], 4)?.code).toBe('INVALID_SEED_RANGE')
    expect(validateSeedPositions([1, 2, 3, 3], 4)?.code).toBe('DUPLICATE_SEED')
    expect(validateSeedPositions([1, 2], 4)?.code).toBe('INCOMPLETE_SEED_SET')
    expect(validateSeedPositions([1, 2, 3, 4], 4)).toBeNull()
  })

  it('validates participant updates against draw roster', () => {
    const issue = validateParticipantSeedUpdates(
      [
        { entryId: 'a', seedPosition: 1 },
        { entryId: 'b', seedPosition: 16 },
      ],
      ['a', 'b'],
    )

    expect(issue?.code).toBe('INVALID_SEED_RANGE')
  })
})
