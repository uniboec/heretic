import type { Prisma } from '@prisma/client'

export const CHAMPION_SINGLETON_FORMAT_RULE: Omit<
  Prisma.BracketFormatRuleCreateManyInput,
  'id' | 'updatedAt'
> = {
  minParticipants: 1,
  maxParticipants: 1,
  systemId: 'champion',
  allowedSystemIds: ['champion'],
  sortOrder: -1,
  enabled: true,
}

export const DEFAULT_FORMAT_RULES: Array<
  Omit<Prisma.BracketFormatRuleCreateManyInput, 'id' | 'updatedAt'>
> = [
  CHAMPION_SINGLETON_FORMAT_RULE,
  {
    minParticipants: 2,
    maxParticipants: 2,
    systemId: 'olympic',
    allowedSystemIds: ['olympic'],
    sortOrder: 0,
    enabled: true,
  },
  {
    minParticipants: 3,
    maxParticipants: 3,
    systemId: 'three_way',
    allowedSystemIds: ['three_way', 'round_robin'],
    sortOrder: 1,
    enabled: true,
  },
  {
    minParticipants: 4,
    maxParticipants: 5,
    systemId: 'olympic',
    defaultBronzeMode: 'ONE',
    allowedSystemIds: ['olympic', 'round_robin'],
    sortOrder: 2,
    enabled: true,
  },
  {
    minParticipants: 6,
    maxParticipants: 32,
    systemId: 'olympic',
    defaultBronzeMode: 'ONE',
    allowedSystemIds: ['olympic'],
    sortOrder: 3,
    enabled: true,
  },
]

export function createDefaultFormatRuleRow(sortOrder: number) {
  return {
    id: crypto.randomUUID(),
    minParticipants: 1,
    maxParticipants: 1,
    systemId: 'champion',
    defaultBronzeMode: null as 'ONE' | 'TWO' | null,
    allowedSystemIds: ['champion'],
    sortOrder,
    enabled: true,
  }
}

export function defaultSystemForRuleRange(minParticipants: number, maxParticipants: number): string {
  return minParticipants === 1 && maxParticipants === 1 ? 'champion' : 'olympic'
}
