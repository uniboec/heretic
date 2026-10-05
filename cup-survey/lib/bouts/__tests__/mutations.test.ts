import { describe, expect, it } from 'vitest'
import { updateBoutsPageSettings, updateBracketDrawMatIndex } from '../../bouts/mutations'

describe('bouts mat settings mutations', () => {
  it('exports locked matCount and matIndex patch helpers', () => {
    expect(typeof updateBoutsPageSettings).toBe('function')
    expect(typeof updateBracketDrawMatIndex).toBe('function')
  })
})
