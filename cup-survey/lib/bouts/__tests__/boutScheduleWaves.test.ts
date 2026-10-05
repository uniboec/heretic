import { describe, expect, it } from 'vitest'
import { mergeBoutScheduleWaves, sanitizeBoutScheduleWaves } from '../boutScheduleWaves'
import { persistBoutScheduleWavesIfChanged } from '../boutScheduleWaves.server'

describe('boutScheduleWaves', () => {
  it('sanitize keeps numeric wave map', () => {
    expect(sanitizeBoutScheduleWaves({ a: 1, b: 2, c: 'x' })).toEqual({ a: 1, b: 2 })
  })

  it('merge overlays newer waves', () => {
    expect(mergeBoutScheduleWaves({ a: 1 }, { a: 3, b: 2 })).toEqual({ a: 3, b: 2 })
  })

  it('persistBoutScheduleWavesIfChanged writes only when changed', async () => {
    const updates: unknown[] = []
    const tx = {
      boutsPageSetting: {
        update: async (input: { data: { boutScheduleWaves: unknown } }) => {
          updates.push(input.data.boutScheduleWaves)
          return {}
        },
      },
    }

    await persistBoutScheduleWavesIfChanged(tx, { a: 1 }, { a: 1 })
    expect(updates).toEqual([])

    await persistBoutScheduleWavesIfChanged(tx, { a: 2 }, { a: 1 })
    expect(updates).toEqual([{ a: 2 }])
  })

  it('survives re-read after persist (restart simulation)', async () => {
    let stored: Record<string, number> = { 'cat::b1': 10 }
    const tx = {
      boutsPageSetting: {
        update: async (input: { data: { boutScheduleWaves: Record<string, number> } }) => {
          stored = input.data.boutScheduleWaves
          return {}
        },
      },
    }

    await persistBoutScheduleWavesIfChanged(tx, { 'cat::b1': 13, 'cat::b2': 14 }, stored)
    const reloaded = sanitizeBoutScheduleWaves(stored)
    expect(reloaded).toEqual({ 'cat::b1': 13, 'cat::b2': 14 })
  })
})
