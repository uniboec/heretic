import type { AnnouncerEventType } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { ensureAnnouncerRules, updateAnnouncerRule } from '../lib/announcer/rules'
import { updateAnnouncerSettings } from '../lib/announcer/settings'
import { prisma } from '../lib/prisma'

const AZURE_MALE = { ttsProvider: 'azure' as const, ttsVoiceId: 'ru-RU-DmitryNeural' }
const AZURE_FEMALE = { ttsProvider: 'azure' as const, ttsVoiceId: 'ru-RU-SvetlanaNeural' }

const VOICE_BY_EVENT_TYPE: Record<AnnouncerEventType, typeof AZURE_MALE> = {
  BOUT_CALL: AZURE_MALE,
  BOUT_PREPARE: AZURE_MALE,
  BOUT_RESULT: AZURE_MALE,
  AWARD_CALL: AZURE_FEMALE,
  AWARD_PREPARE: AZURE_FEMALE,
}

async function main() {
  await updateAnnouncerSettings({
    primaryProvider: 'azure',
    primaryVoiceId: 'ru-RU-DmitryNeural',
    fallbackProvider1: 'yandex',
    fallbackVoiceId1: null,
  })
  console.log('Глобальный TTS: azure / Dmitry (fallback: yandex)')

  await ensureAnnouncerRules(TOURNAMENT_SCOPE_ID)

  for (const [eventType, voice] of Object.entries(VOICE_BY_EVENT_TYPE) as Array<
    [AnnouncerEventType, typeof AZURE_MALE]
  >) {
    await updateAnnouncerRule(eventType, voice, TOURNAMENT_SCOPE_ID)
    console.log(`${eventType}: ${voice.ttsProvider} / ${voice.ttsVoiceId}`)
  }

  console.log('Голоса по типам событий обновлены.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
