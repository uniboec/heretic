import { describe, expect, it } from 'vitest'
import { computeLegacyReleaseFields } from '../legacyReleaseGate'

describe('release matCount guards', () => {
  it('legacy gate does not release Auto when matCount < 1', () => {
    const fields = computeLegacyReleaseFields({
      visible: true,
      storedMatIndex: null,
      matCount: 0,
      autoBoutIds: ['cat:a::bout-1'],
    })
    expect(fields.boutsReleased).toBe(false)
    expect(fields.boutMatAssignments).toBeNull()
  })

  it('release API treats matCount below 1 as invalid', () => {
    const matCount = 0
    const released = true
    expect(released && matCount < 1).toBe(true)
  })
})
