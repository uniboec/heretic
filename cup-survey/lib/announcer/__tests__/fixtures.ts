import type { AnnouncerEvent, AnnouncerRule, AnnouncerSetting } from '@prisma/client'

export function testAnnouncerRule(overrides: Partial<AnnouncerRule> = {}): AnnouncerRule {
  return {
    id: 'rule-1',
    tournamentScopeId: 'cup-2026',
    eventType: 'BOUT_CALL',
    enabled: true,
    priority: 100,
    nameFormat: 'LAST_FIRST',
    includeMat: true,
    includeCategory: true,
    includeCorner: false,
    includeClub: true,
    includeCity: false,
    includeMethod: false,
    includePlacement: false,
    includeAge: true,
    includeWeight: true,
    includeCueSound: false,
    cueSoundId: null,
    ttlSeconds: 120,
    ttsProvider: null,
    ttsVoiceId: null,
    ...overrides,
  }
}

export function testAnnouncerSetting(
  overrides: Partial<AnnouncerSetting> = {},
): AnnouncerSetting {
  return {
    tournamentScopeId: 'cup-2026',
    enabled: true,
    mode: 'AUTO',
    primaryProvider: 'yandex',
    primaryVoiceId: 'marina',
    fallbackProvider1: 'azure',
    fallbackVoiceId1: null,
    fallbackProvider2: null,
    fallbackVoiceId2: null,
    speechRate: 1,
    announcementGapMs: 3000,
    cueToSpeechGapMs: 700,
    nextPlaybackAllowedAt: null,
    boutCueSoundId: 'universfield-032',
    awardCueSoundId: 'chime-01',
    cueVolume: 0.7,
    updatedAt: new Date(),
    ...overrides,
  }
}

export function testAnnouncerEvent(overrides: Partial<AnnouncerEvent> = {}): AnnouncerEvent {
  return {
    id: 'event-1',
    tournamentScopeId: 'cup-2026',
    type: 'BOUT_CALL',
    priority: 100,
    sourceId: 'source-1',
    dedupeKey: 'dedupe-1',
    payload: {},
    textSnapshot: 'test',
    audioCacheKey: null,
    audioDurationMs: null,
    status: 'QUEUED',
    expiresAt: null,
    createdAt: new Date(),
    playedAt: null,
    failureReason: null,
    generationToken: null,
    generationStartedAt: null,
    generationLeaseUntil: null,
    generationTtsSignature: null,
    ttsProviderUsed: null,
    ttsVoiceIdUsed: null,
    claimedAt: null,
    claimToken: null,
    leaseUntil: null,
    ...overrides,
  }
}
