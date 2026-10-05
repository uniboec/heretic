import { describe, expect, it } from 'vitest'
import {
  hasStageDraftErrors,
  validateDurationOverridesDraft,
  validateMatOverridesDraft,
  validateStageDraft,
} from '../validateBoutsAdvancedDraft'
import { validateTimingDraft } from '../validateBoutsTimingDraft'

describe('validateMatOverridesDraft', () => {
  it('accepts empty values', () => {
    expect(validateMatOverridesDraft({ '1': '', '2': '  ' })).toEqual({})
  })

  it('accepts valid HH:mm', () => {
    expect(validateMatOverridesDraft({ '2': '10:30' })).toEqual({})
  })

  it('rejects invalid time', () => {
    expect(validateMatOverridesDraft({ '1': '25:00' })).toEqual({
      '1': 'Укажите время в формате HH:mm',
    })
  })
})

describe('validateStageDraft', () => {
  it('accepts empty optional fields', () => {
    expect(validateStageDraft({ breaks: { '1': '' }, notBefore: { '2': '' } })).toEqual({
      breaks: {},
      notBefore: {},
    })
  })

  it('rejects invalid break minutes', () => {
    const errors = validateStageDraft({ breaks: { '1': '99999' }, notBefore: {} })
    expect(errors.breaks['1']).toMatch(/От 0 до/)
    expect(hasStageDraftErrors(errors)).toBe(true)
  })

  it('rejects invalid not-before time', () => {
    const errors = validateStageDraft({ breaks: {}, notBefore: { '2': '99:99' } })
    expect(errors.notBefore['2']).toBe('Укажите время в формате HH:mm')
  })
})

describe('validateDurationOverridesDraft', () => {
  it('accepts empty override', () => {
    expect(validateDurationOverridesDraft({ m_boys_1: '' })).toEqual({})
  })

  it('rejects out-of-range duration', () => {
    expect(validateDurationOverridesDraft({ m_boys_1: '0' })).toEqual({
      m_boys_1: 'От 1 до 60 мин',
    })
  })
})

describe('validateTimingDraft', () => {
  it('rejects invalid start time', () => {
    expect(validateTimingDraft({ boutsStartTime: '99:99', boutBreakMinutes: 3 })).toEqual({
      boutsStartTime: 'Укажите время в формате HH:mm',
    })
  })
})
