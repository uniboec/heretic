import 'dotenv/config'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { prisma } from '../lib/prisma'
import { getAnnouncerRules } from '../lib/announcer/rules'
import { getAnnouncerSettings } from '../lib/announcer/settings'
import { buildTtsSignature } from '../lib/announcer/tts/signature'
import { synthesizeForEvent } from '../lib/announcer/tts/synthesize'
import { buildAnnouncementText } from '../lib/announcer/text/buildText'
import { normalizeAnnouncerText } from '../lib/announcer/text/normalize'

async function main() {
  const settings = await getAnnouncerSettings(TOURNAMENT_SCOPE_ID)
  const rules = await getAnnouncerRules(TOURNAMENT_SCOPE_ID)

  console.log('=== Announcer settings ===')
  console.log(`enabled=${settings.enabled} mode=${settings.mode}`)
  console.log(
    `global: ${settings.primaryProvider}/${settings.primaryVoiceId ?? 'default'} fallback=${settings.fallbackProvider1}`,
  )

  console.log('\n=== Voice rules ===')
  for (const rule of rules) {
    const signature = buildTtsSignature(settings, rule)
    const voice =
      rule.ttsProvider
        ? `${rule.ttsProvider}/${rule.ttsVoiceId ?? 'default'}`
        : 'global default'
    console.log(`${rule.eventType}: ${voice} [sig=${signature}]`)
  }

  const boutRule = rules.find((r) => r.eventType === 'BOUT_CALL')
  const awardRule = rules.find((r) => r.eventType === 'AWARD_CALL')
  if (!boutRule || !awardRule) throw new Error('Missing rules')

  const boutText = normalizeAnnouncerText(
    buildAnnouncementText(
      'BOUT_CALL',
      {
        boutId: 'smoke',
        matIndex: 1,
        sideA: { corner: 'red', displayName: 'Иванов Иван' },
        sideB: { corner: 'blue', displayName: 'Петров Пётр' },
      },
      boutRule,
    ),
  )
  const awardText = normalizeAnnouncerText(
    buildAnnouncementText(
      'AWARD_CALL',
      {
        queueId: 'smoke',
        categoryTitle: 'Юноши до 50 кг',
        placements: [{ placement: 1, displayName: 'Сидоров Сидор' }],
      },
      awardRule,
    ),
  )

  console.log('\n=== Synthesis smoke ===')
  for (const [label, rule, text] of [
    ['BOUT_CALL', boutRule, boutText],
    ['AWARD_CALL', awardRule, awardText],
  ] as const) {
    try {
      const result = await synthesizeForEvent(settings, rule, text)
      console.log(
        `${label}: ok provider=${result.providerUsed} voice=${result.voiceIdUsed} bytes cache=${result.cacheKey.slice(0, 40)}...`,
      )
    } catch (error) {
      console.error(`${label}: FAIL`, error instanceof Error ? error.message : error)
      process.exitCode = 1
    }
  }

  const counts = await prisma.announcerEvent.groupBy({
    by: ['status'],
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    _count: true,
  })
  console.log('\n=== Queue status ===')
  for (const row of counts) {
    console.log(`${row.status}: ${row._count}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
