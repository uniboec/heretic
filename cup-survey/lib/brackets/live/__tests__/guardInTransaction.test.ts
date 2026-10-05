import { describe, expect, it } from 'vitest'
import { assertRestoreAllowed } from '../guard'
import { BracketOperationError } from '../../core/errors'

describe('guardInTransaction', () => {
  it('assertRestoreAllowed blocks RELEASED categories', () => {
    expect(() => assertRestoreAllowed(['cat:released'])).toThrow(BracketOperationError)
    try {
      assertRestoreAllowed(['cat:released'])
    } catch (error) {
      expect(error).toMatchObject({ code: 'RESTORE_AFFECTED_RELEASED_CATEGORY' })
    }
  })

  it('assertRestoreAllowed allows OPEN-only affected set', () => {
    expect(() => assertRestoreAllowed([])).not.toThrow()
  })
})
