import { describe, expect, it } from 'vitest'
import type { AnnouncerRule } from '@prisma/client'
import {
  formatAnnouncerRuleCueSummary,
  formatAnnouncerRuleIncludeSummary,
  formatAnnouncerRuleVoiceSummary,
} from '../ruleDisplay'

const baseRule = {
  eventType: 'BOUT_CALL',
  enabled: true,
  includeMat: true,
  includeCategory: true,
  includeCorner: false,
  includeClub: false,
  includeCity: false,
  includeMethod: false,
  includePlacement: false,
  includeAge: false,
  includeWeight: false,
  includeCueSound: true,
  cueSoundId: 'chime-01',
  ttsProvider: null,
  ttsVoiceId: null,
} as AnnouncerRule

describe('ruleDisplay', () => {
  it('summarizes enabled include fields', () => {
    expect(formatAnnouncerRuleIncludeSummary(baseRule)).toBe('Татами · Категория · Сигнал')
  })

  it('summarizes default voice', () => {
    expect(formatAnnouncerRuleVoiceSummary(baseRule, [])).toBe('Голос по умолчанию')
  })

  it('summarizes cue sound label', () => {
    expect(
      formatAnnouncerRuleCueSummary(baseRule, [
        { id: 'chime-01', label: 'Колокольчик', family: 'neutral', path: '/x.mp3', durationMs: 700 },
      ]),
    ).toBe('Колокольчик')
  })
})
