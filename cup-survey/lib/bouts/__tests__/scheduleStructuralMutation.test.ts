import { describe, expect, it } from 'vitest'
import { BoutNotNextInScheduleError } from '../errors'
import { assertBoutCanBeFrozen } from '../scheduleDisplayNumber'

describe('schedule freeze guards', () => {
  it('rejects freeze when bout is not next startable', () => {
    expect(() => assertBoutCanBeFrozen('bout-b', 'bout-a')).toThrow(BoutNotNextInScheduleError)
  })

  it('allows freeze for next startable bout', () => {
    expect(() => assertBoutCanBeFrozen('bout-a', 'bout-a')).not.toThrow()
  })
})
