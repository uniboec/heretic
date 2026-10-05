import { describe, expect, it } from 'vitest'
import { deserializePublishedStructure, serializePublishedStructure } from '../core/snapshot'

describe('published structure snapshot', () => {
  it('round-trips v1 envelope', () => {
    const snapshot = serializePublishedStructure({
      systemId: 'olympic',
      systemVersion: 1,
      structure: {
        systemId: 'olympic',
        systemVersion: 1,
        rounds: [],
      },
    })
    expect(deserializePublishedStructure(snapshot)?.structure.systemId).toBe('olympic')
  })

  it('rejects unknown schema version', () => {
    expect(deserializePublishedStructure({ snapshotSchemaVersion: 2 })).toBeNull()
  })
})
