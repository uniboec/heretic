/**
 * Локальная демо-настройка: участники, сетки и поединки на публичных страницах.
 *
 * Запуск: npm run setup:local-public
 *
 * Требует: docker compose up -d, npm run db:deploy, dev-сервер (npm run dev) для INDEPENDENT_BOUTS_RELEASE.
 */
import { DEFAULT_FORMAT_RULES } from '../lib/brackets/defaultFormatRules'
import { prisma } from '../lib/prisma'
import { loadEligibleEntries } from '../lib/brackets/core/eligibility'
import { ensureDraftExists } from '../lib/brackets/generation/ensureDraft'
import { publishBracketDraft } from '../lib/brackets/generation/publish'
import { redrawBracketDraft } from '../lib/brackets/generation/redraw'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { setCategoriesBoutsReleased } from '../lib/bouts/release'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'
import { enableAutoMatByCategory } from '../lib/bouts/enableAutoMatByCategory'

async function ensureBracketDefaults() {
  await prisma.tournamentRegistrationState.upsert({
    where: { id: 'default' },
    create: { revision: BigInt(0) },
    update: {},
  })
  await prisma.bracketPageSetting.upsert({
    where: { id: 'default' },
    create: { publicEnabled: false, includePaid: true, includeUnpaid: false },
    update: {},
  })
  await prisma.boutsPageSetting.upsert({
    where: { id: 'default' },
    create: {
      publicEnabled: false,
      matCount: 3,
      autoMatAssignMode: 'BY_CATEGORY',
      autoMatByCategoryEnabled: true,
      athleteParticipationSpacing: {
        enabled: true,
        mode: 'BOUT_COUNT',
        regular: 2,
        medal: 5,
      },
    },
    update: {},
  })
  const ruleCount = await prisma.bracketFormatRule.count()
  if (ruleCount === 0) {
    await prisma.bracketFormatRule.createMany({ data: DEFAULT_FORMAT_RULES })
  }
}

async function seedIfEmpty() {
  const athleteCount = await prisma.athlete.count()
  if (athleteCount > 0) {
    console.log(`Участники уже есть (${athleteCount}), seed пропущен`)
    return
  }

  console.log('Нет участников — запуск seed:bracket-sizes…')
  const { execSync } = await import('child_process')
  execSync('npm run seed:bracket-sizes', { stdio: 'inherit', cwd: process.cwd() })
}

async function syncAndPublish() {
  const settings = await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })
  const eligible = await loadEligibleEntries({
    includePaid: settings?.includePaid ?? true,
    includeUnpaid: settings?.includeUnpaid ?? false,
  })

  if (eligible.length === 0) {
    throw new Error(
      'Нет допущенных участников. Выполните npm run seed:bracket-sizes или seed:registrations.',
    )
  }

  const draft = await ensureDraftExists()
  console.log(`Черновик ${draft.id}, допущено: ${eligible.length}`)

  const synced = await syncBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
  })

  const redrawn = await redrawBracketDraft({
    draftId: synced.draft.id,
    expectedVersion: synced.draft.version,
    scope: 'all',
  })

  const published = await publishBracketDraft({
    draftId: redrawn.draft.id,
    expectedVersion: redrawn.draft.version,
  })

  console.log(`Снимок опубликован: ${published.publishedGenerationId}`)
  return published.publishedGenerationId
}

async function enablePublicPages(publishedGenerationId: string) {
  await prisma.bracketPageSetting.update({
    where: { id: 'default' },
    data: { publicEnabled: true },
  })
  await prisma.boutsPageSetting.update({
    where: { id: 'default' },
    data: { publicEnabled: true, matCount: 3 },
  })

  const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
  if (!settings.autoMatByCategoryEnabled || settings.autoMatAssignMode !== 'BY_CATEGORY') {
    try {
      if (!settings.autoMatByCategoryEnabled) {
        await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))
      } else {
        await prisma.boutsPageSetting.update({
          where: { id: 'default' },
          data: { autoMatAssignMode: 'BY_CATEGORY' },
        })
      }
      console.log('Режим Auto: категория на одной площадке (BY_CATEGORY)')
    } catch (error) {
      console.warn('Cutover BY_CATEGORY пропущен:', error instanceof Error ? error.message : error)
    }
  }

  const activeDraws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: publishedGenerationId, status: 'ACTIVE' },
    include: { participants: true },
  })
  const readyDraws = activeDraws.filter((draw) => draw.participants.length >= 2)

  for (const draw of readyDraws) {
    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: draw.categoryKey,
      visible: true,
    })
  }
  console.log(`Видимость /brackets: ${readyDraws.length} категорий`)

  const releaseResult = await setCategoriesBoutsReleased({
    scope: 'ready',
    released: true,
    expectedPublishedGenerationId: publishedGenerationId,
  })
  console.log(
    `Выпуск /bouts: ${releaseResult.affectedCategoryKeys?.length ?? 0} категорий`,
  )
}

async function printSummary() {
  const athletes = await prisma.athlete.count()
  const publicRegs = await prisma.teamRegistration.count({ where: { consentPublication: true } })
  const visible = await prisma.bracketPublicationState.count({ where: { visible: true } })
  const released = await prisma.bracketPublicationState.count({ where: { boutsReleased: true } })
  const bracketSettings = await prisma.bracketPageSetting.findUniqueOrThrow({
    where: { id: 'default' },
  })
  const boutsSettings = await prisma.boutsPageSetting.findUniqueOrThrow({
    where: { id: 'default' },
  })

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  console.log('\n=== Готово ===')
  console.log(`Участники в БД: ${athletes} (${publicRegs} заявок с consentPublication)`)
  console.log(`Сетки visible: ${visible}, поединки released: ${released}`)
  console.log(`brackets.publicEnabled=${bracketSettings.publicEnabled}, bouts.publicEnabled=${boutsSettings.publicEnabled}`)
  console.log('\nПубличные страницы:')
  console.log(`  ${base}/athletes  — спортсмены`)
  console.log(`  ${base}/brackets   — сетки`)
  console.log(`  ${base}/bouts      — поединки`)
  console.log('\nЕсли /bouts пуст — перезапустите dev-сервер (INDEPENDENT_BOUTS_RELEASE=true в .env).')
}

async function main() {
  console.log('=== Setup local public demo ===\n')
  await ensureBracketDefaults()
  await seedIfEmpty()
  const publishedGenerationId = await syncAndPublish()
  await enablePublicPages(publishedGenerationId)
  await printSummary()
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
