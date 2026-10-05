import { describe, expect, it } from 'vitest'
import {
  isBronzeModeConfigurableForCategory,
  isBronzeModeConfigurableForFormatRule,
  resolveCategoryFormat,
  validateEntireRuleSet,
} from '../core/formatRules'
import { formatValidationIssueMessage } from '../labels'
import type { BracketFormatRuleLike } from '../core/types'
import '../systems'

const championRule: BracketFormatRuleLike = {
  id: '0',
  minParticipants: 1,
  maxParticipants: 1,
  systemId: 'champion',
  defaultBronzeMode: null,
  allowedSystemIds: ['champion'],
  sortOrder: -1,
  enabled: true,
}

const defaultRules: BracketFormatRuleLike[] = [
  championRule,
  {
    id: '1',
    minParticipants: 2,
    maxParticipants: 2,
    systemId: 'olympic',
    defaultBronzeMode: null,
    allowedSystemIds: ['olympic'],
    sortOrder: 0,
    enabled: true,
  },
  {
    id: '2',
    minParticipants: 3,
    maxParticipants: 3,
    systemId: 'three_way',
    defaultBronzeMode: null,
    allowedSystemIds: ['three_way', 'round_robin'],
    sortOrder: 1,
    enabled: true,
  },
  {
    id: '3',
    minParticipants: 4,
    maxParticipants: 5,
    systemId: 'olympic',
    defaultBronzeMode: 'ONE' as const,
    allowedSystemIds: ['olympic', 'round_robin'],
    sortOrder: 2,
    enabled: true,
  },
  {
    id: '4',
    minParticipants: 6,
    maxParticipants: 32,
    systemId: 'olympic',
    defaultBronzeMode: 'ONE' as const,
    allowedSystemIds: ['olympic'],
    sortOrder: 3,
    enabled: true,
  },
]

describe('resolveCategoryFormat', () => {
  it('returns INACTIVE for N=0', () => {
    expect(resolveCategoryFormat(0, defaultRules).status).toBe('INACTIVE')
  })

  it('resolves N=1 champion', () => {
    const result = resolveCategoryFormat(1, defaultRules)
    expect(result.status).toBe('ACTIVE')
    expect(result.rule?.systemId).toBe('champion')
  })

  it('resolves N=2 olympic', () => {
    const result = resolveCategoryFormat(2, defaultRules)
    expect(result.status).toBe('ACTIVE')
    expect(result.rule?.systemId).toBe('olympic')
  })

  it('resolves N=3 three_way', () => {
    const result = resolveCategoryFormat(3, defaultRules)
    expect(result.status).toBe('ACTIVE')
    expect(result.rule?.systemId).toBe('three_way')
  })

  it('returns UNSUPPORTED when no rule', () => {
    const result = resolveCategoryFormat(33, defaultRules)
    expect(result.status).toBe('UNSUPPORTED')
    expect(result.statusReason).toBe('NO_FORMAT_RULE')
  })
})

describe('bronze mode configurability', () => {
  it('is unavailable for small participant ranges', () => {
    expect(isBronzeModeConfigurableForFormatRule('olympic', 3)).toBe(false)
    expect(isBronzeModeConfigurableForFormatRule('olympic', 2)).toBe(false)
    expect(isBronzeModeConfigurableForFormatRule('round_robin', 8)).toBe(false)
    expect(isBronzeModeConfigurableForFormatRule('olympic', 4)).toBe(true)
  })

  it('is unavailable for categories with fewer than 4 participants', () => {
    expect(isBronzeModeConfigurableForCategory('olympic', 3)).toBe(false)
    expect(isBronzeModeConfigurableForCategory('olympic', 4)).toBe(true)
  })
})

describe('validateEntireRuleSet', () => {
  it('accepts default seed rules with champion', () => {
    expect(validateEntireRuleSet(defaultRules)).toHaveLength(0)
  })

  it('rejects olympic on 1-1 range', () => {
    const bad = [
      {
        ...championRule,
        systemId: 'olympic',
        allowedSystemIds: ['olympic'],
      },
    ]
    expect(validateEntireRuleSet(bad).some((e) => e.code === 'INVALID_SYSTEM_FOR_RANGE')).toBe(true)
  })

  it('rejects champion outside 1-1', () => {
    const bad = [
      {
        ...championRule,
        minParticipants: 1,
        maxParticipants: 2,
      },
    ]
    expect(validateEntireRuleSet(bad).some((e) => e.code === 'INVALID_CHAMPION_RANGE')).toBe(true)
    expect(formatValidationIssueMessage({ code: 'INVALID_CHAMPION_RANGE' })).toContain('1–1')
  })

  it('rejects bronze mode for rules with maxParticipants below 4', () => {
    const bad = [
      {
        ...defaultRules[1],
        maxParticipants: 3,
        minParticipants: 3,
        systemId: 'olympic',
        defaultBronzeMode: 'ONE' as const,
        allowedSystemIds: ['olympic'],
      },
    ]
    expect(validateEntireRuleSet(bad).some((e) => e.code === 'INVALID_BRONZE_MODE')).toBe(true)
  })

  it('rejects overlapping ranges', () => {
    const bad = [
      ...defaultRules.slice(0, 4),
      { ...defaultRules[4], minParticipants: 5, maxParticipants: 32 },
    ]
    expect(validateEntireRuleSet(bad).some((e) => e.code === 'OVERLAPPING_RANGES')).toBe(true)
  })

  it('rejects gap at n=1 when champion rule disabled', () => {
    const withoutChampion = defaultRules.map((rule) =>
      rule.systemId === 'champion' ? { ...rule, enabled: false } : rule,
    )
    expect(validateEntireRuleSet(withoutChampion).some((e) => e.code === 'RANGE_GAP')).toBe(true)
  })
})
