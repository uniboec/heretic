import { prisma } from '../lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'

async function main() {
  await prisma.announcerSetting.upsert({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    create: {
      tournamentScopeId: TOURNAMENT_SCOPE_ID,
      enabled: false,
      mode: 'AUTO',
      primaryProvider: 'yandex',
      fallbackProvider1: 'azure',
      speechRate: 1,
      announcementGapMs: 3000,
      cueToSpeechGapMs: 700,
      boutCueSoundId: 'universfield-032',
      awardCueSoundId: 'chime-01',
      cueVolume: 0.7,
    },
    update: {
      primaryProvider: 'yandex',
      fallbackProvider1: 'azure',
      fallbackProvider2: null,
    },
  })
  console.log('Announcer TTS: primary=yandex, fallback=azure')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
