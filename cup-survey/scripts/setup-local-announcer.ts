import 'dotenv/config'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { ensureAnnouncerRules } from '../lib/announcer/rules'
import { ensureAnnouncerSettings } from '../lib/announcer/settings'
import { ensureAwardsPageSettings } from '../lib/awards/settings'
import { prisma } from '../lib/prisma'

async function waitForLocalTts(maxAttempts = 15) {
  const base = process.env.EDGE_TTS_URL ?? 'http://127.0.0.1:5500'
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${base.replace(/\/$/, '')}/health`, {
        signal: AbortSignal.timeout(1500),
      })
      if (response.ok) return true
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return false
}

async function main() {
  const ttsReady = await waitForLocalTts()
  if (!ttsReady) {
    console.warn('[setup-local-announcer] Local TTS server not reachable — skipping provider switch')
    return
  }

  await ensureAnnouncerSettings()
  await ensureAnnouncerRules()
  await ensureAwardsPageSettings()

  await prisma.announcerSetting.update({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    data: {
      primaryProvider: 'edge',
      primaryVoiceId: 'ru-RU-DmitryNeural',
      fallbackProvider1: 'azure',
      fallbackVoiceId1: 'ru-RU-DmitryNeural',
      fallbackProvider2: 'yandex',
      fallbackVoiceId2: 'marina',
    },
  })

  await prisma.awardsPageSetting.update({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    data: { publicEnabled: true },
  })

  console.log('[setup-local-announcer] edge TTS primary, awards public page enabled')
}

main()
  .catch((error) => {
    console.error('[setup-local-announcer]', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
