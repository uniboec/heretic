import { describe, expect, it } from 'vitest'
import {
  InvalidBoutDurationInputError,
  parseBoutDurationInput,
} from '../parseBoutDurationInput'

describe('parseBoutDurationInput', () => {
  it('parses mm:ss format', () => {
    expect(parseBoutDurationInput('3:00')).toBe(180_000)
    expect(parseBoutDurationInput('03:30')).toBe(210_000)
  })

  it('parses plain minutes and decimal minutes', () => {
    expect(parseBoutDurationInput('3')).toBe(180_000)
    expect(parseBoutDurationInput('2.5')).toBe(150_000)
  })

  it('parses compact and suffixed formats', () => {
    expect(parseBoutDurationInput('2m30s')).toBe(150_000)
    expect(parseBoutDurationInput('90s')).toBe(90_000)
    expect(parseBoutDurationInput('4m')).toBe(240_000)
  })

  it('parses large integers as seconds', () => {
    expect(parseBoutDurationInput('180')).toBe(180_000)
  })

  it('rejects invalid values', () => {
    expect(() => parseBoutDurationInput('')).toThrow(InvalidBoutDurationInputError)
    expect(() => parseBoutDurationInput('3:90')).toThrow(InvalidBoutDurationInputError)
    expect(() => parseBoutDurationInput('abc')).toThrow(InvalidBoutDurationInputError)
  })
})
