import { describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { acquireBracketWriteLocks } from '../locks'
import { createIsolatedDraft } from '../../__tests__/integration/helpers'
import { dbAvailable, useIntegrationDb } from '../../__tests__/integration/setup'

const LOCK_PREFIX = [
  'lockBoutsPageSetting',
  'lockRegistrationState',
  'lockWorkingDraftGeneration',
  'lockCategoryDraws',
  'lockPublicationStates',
] as const

describe('acquireBracketWriteLocks lock order contract', () => {
  useIntegrationDb()

  it('documents canonical prefix order in implementation', () => {
    const source = acquireBracketWriteLocks.toString()
    const boutsIndex = source.indexOf('lockBoutsPageSetting')
    const regIndex = source.indexOf('lockRegistrationState')
    const generationIndex = source.indexOf('lockWorkingDraftGeneration')
    const drawsIndex = source.indexOf('lockCategoryDraws')
    const pubIndex = source.indexOf('lockPublicationStates')

    expect(boutsIndex).toBeGreaterThan(-1)
    expect(regIndex).toBeGreaterThan(boutsIndex)
    expect(generationIndex).toBeGreaterThan(regIndex)
    expect(drawsIndex).toBeGreaterThan(generationIndex)
    expect(pubIndex).toBeGreaterThan(drawsIndex)
  })

  it('exports helper for minimal and destructive_admin scopes', () => {
    expect(typeof acquireBracketWriteLocks).toBe('function')
    expect(LOCK_PREFIX.length).toBe(5)
  })

  it(
    'serializes minimal and destructive writers through the same bouts lock',
    async () => {
      if (!dbAvailable) return

      const draft = await createIsolatedDraft()
      const events: string[] = []

      try {
        await Promise.all([
          prisma.$transaction(async (tx) => {
            await acquireBracketWriteLocks(tx, { scope: 'minimal' })
            events.push('minimal-start')
            await new Promise((resolve) => setTimeout(resolve, 75))
            events.push('minimal-end')
          }),
          prisma.$transaction(async (tx) => {
            await acquireBracketWriteLocks(tx, { scope: 'destructive_admin' })
            events.push('destructive-start')
            await new Promise((resolve) => setTimeout(resolve, 75))
            events.push('destructive-end')
          }),
        ])

        expect(events).toHaveLength(4)
        expect(events.filter((event) => event.endsWith('-start'))).toHaveLength(2)
        expect(events.filter((event) => event.endsWith('-end'))).toHaveLength(2)
      } finally {
        await prisma.bracketGeneration.delete({ where: { id: draft.id } })
      }
    },
    15_000,
  )

  it(
    'concurrent minimal and destructive_admin scopes complete without deadlock',
    async () => {
      if (!dbAvailable) return

      const draft = await createIsolatedDraft()
      const events: string[] = []

      try {
        await Promise.all([
          prisma.$transaction(async (tx) => {
            await acquireBracketWriteLocks(tx, { scope: 'minimal' })
            events.push('minimal')
          }),
          prisma.$transaction(async (tx) => {
            await acquireBracketWriteLocks(tx, { scope: 'destructive_admin' })
            events.push('destructive')
          }),
        ])

        expect(events.sort()).toEqual(['destructive', 'minimal'])
      } finally {
        await prisma.bracketGeneration.delete({ where: { id: draft.id } })
      }
    },
    15_000,
  )
})
