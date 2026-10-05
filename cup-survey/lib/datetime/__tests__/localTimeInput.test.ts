import { describe, expect, it } from 'vitest'
import { formatLocalTimeInput } from '../localTimeInput'

describe('formatLocalTimeInput', () => {
  it('inserts colon after two hour digits', () => {
    expect(formatLocalTimeInput('1')).toBe('1')
    expect(formatLocalTimeInput('10')).toBe('10')
    expect(formatLocalTimeInput('103')).toBe('10:3')
    expect(formatLocalTimeInput('1030')).toBe('10:30')
  })

  it('normalizes pasted values with colon', () => {
    expect(formatLocalTimeInput('10:30')).toBe('10:30')
    expect(formatLocalTimeInput('10:3')).toBe('10:3')
  })

  it('strips non-digits and caps length', () => {
    expect(formatLocalTimeInput('1a0b:3c0')).toBe('10:30')
    expect(formatLocalTimeInput('123456')).toBe('12:34')
  })
})
