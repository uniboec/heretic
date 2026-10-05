import 'dotenv/config'
import { randomUUID } from 'crypto'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { prisma } from '../lib/prisma'
import { syncPosition } from '../lib/announcer/positionState'
import { createResultEvent } from '../lib/announcer/positionState'
import { generateAudioForQueuedEvent } from '../lib/announcer/processor'
import { getRuleForType } from '../lib/announcer/rules'
import { buildTtsSignature } from '../lib/announcer/tts/signature'

const scopeId = TOURNAMENT_SCOPE_ID
const scopeKey = `smoke:mat:99:call`

async function main() {
  await prisma.announcerSetting.update({
    where: { tournamentScopeId: scopeId },
    data: { enabled: true, mode: 'MANUAL', nextPlaybackAllowedAt: null },
  })

  const boutId = `smoke-bout-${randomUUID().slice(0, 8)}`
  const payload = {
    boutId,
    matIndex: 99,
    sideA: { corner: 'red' as const, displayName: 'Смоков Смок' },
    sideB: { corner: 'blue' as const, displayName: 'Тестов Тест' },
  }

  await syncPosition({
    scopeId,
    scopeKey,
    newPositionId: boutId,
    eventType: 'BOUT_CALL',
    payloadBuilder: () => payload,
    sourceId: boutId,
  })

  const boutEvent = await prisma.announcerEvent.findFirst({
    where: { tournamentScopeId: scopeId, dedupeKey: { contains: boutId } },
    orderBy: { createdAt: 'desc' },
  })
  if (!boutEvent) throw new Error('BOUT_CALL event not created')
  console.log(`BOUT_CALL queued: ${boutEvent.id}`)

  const ready = await generateAudioForQueuedEvent(boutEvent.id)
  if (!ready) throw new Error('BOUT_CALL audio generation failed')

  const readyEvent = await prisma.announcerEvent.findUniqueOrThrow({ where: { id: boutEvent.id } })
  console.log(
    `BOUT_CALL ready: voice=${readyEvent.ttsProviderUsed}/${readyEvent.ttsVoiceIdUsed} cache=${Boolean(readyEvent.audioCacheKey)}`,
  )

  const rule = await getRuleForType('BOUT_CALL', scopeId)
  const settings = await prisma.announcerSetting.findUniqueOrThrow({
    where: { tournamentScopeId: scopeId },
  })
  const expectedSig = buildTtsSignature(settings, rule)
  if (readyEvent.generationTtsSignature !== expectedSig) {
    throw new Error(
      `Signature mismatch: ${readyEvent.generationTtsSignature} vs ${expectedSig}`,
    )
  }

  const resultId = randomUUID()
  await createResultEvent({
    scopeId,
    eventType: 'BOUT_RESULT',
    dedupeKey: `BOUT_RESULT:${boutId}:${resultId}`,
    payload: {
      boutId,
      boutResultId: resultId,
      matIndex: 99,
      winnerCorner: 'red',
      displayName: 'Смоков Смок',
      victoryMethod: 'POINTS',
    },
    sourceId: boutId,
  })

  const resultEvent = await prisma.announcerEvent.findFirst({
    where: { tournamentScopeId: scopeId, type: 'BOUT_RESULT', sourceId: boutId },
    orderBy: { createdAt: 'desc' },
  })
  if (!resultEvent) throw new Error('BOUT_RESULT event not created')
  console.log(`BOUT_RESULT queued: ${resultEvent.id}`)

  console.log('Flow smoke: OK')
}

main()
  .catch((error) => {
    console.error('Flow smoke FAILED:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
