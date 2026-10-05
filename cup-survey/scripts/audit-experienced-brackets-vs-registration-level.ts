#!/usr/bin/env npx tsx
/**
 * Read-only: experienced bracket categories vs original registration experience level.
 * npx tsx scripts/audit-experienced-brackets-vs-registration-level.ts
 */
import { prisma } from '../lib/prisma'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { getCategoryTitleFromKey, parseRegistrationCategoryKey } from '../lib/registration/categoryIdentity'
import { normalizeExperienceLevelForSort } from '../lib/registration/categoryRules'
import { getExperienceLevelLabel } from '../lib/config/experienceLevel'
import { formatAthleteFullName } from '../lib/registration/athleteName'
import { isEntryEligibleForParticipation, type EntryPaymentStatus } from '../lib/registration/status'

function levelLabel(id: string): string {
  return getExperienceLevelLabel(normalizeExperienceLevelForSort(id) as 'novice' | 'experienced')
}

async function main() {
  const generation = await requireWorkingGeneration(prisma)
  const draws = await prisma.bracketCategoryDraw.findMany({
    where: {
      generationId: generation.id,
      status: 'ACTIVE',
      categoryKey: { contains: ':experienced:' },
    },
    include: {
      participants: { orderBy: { seedPosition: 'asc' } },
    },
    orderBy: { categoryKey: 'asc' },
  })

  type ParticipantRow = {
    name: string
    registeredLevel: string
    sourceCategoryTitle: string
    paymentStatus: string
  }

  type CategoryReport = {
    categoryKey: string
    title: string
    count: number
    noviceCount: number
    experiencedCount: number
    otherCount: number
    participants: ParticipantRow[]
  }

  const allNovice: CategoryReport[] = []
  const mixed: CategoryReport[] = []
  const allExperienced: CategoryReport[] = []

  for (const draw of draws) {
    if (draw.participants.length === 0) continue

    const participants: ParticipantRow[] = []
    let noviceCount = 0
    let experiencedCount = 0
    let otherCount = 0

    for (const p of draw.participants) {
      const entry = await prisma.athleteEntry.findUnique({
        where: { id: p.entryId },
        include: { athlete: true },
      })
      if (!entry) {
        otherCount += 1
        participants.push({
          name: p.entryId,
          registeredLevel: '?',
          sourceCategoryTitle: '—',
          paymentStatus: '?',
        })
        continue
      }

      const registered = normalizeExperienceLevelForSort(entry.experienceLevel)
      const sourceKey = `${entry.discipline}:${entry.experienceLevel}:${entry.ageDivisionId}:${entry.weightCategoryId}`
      const sourceIdentity = parseRegistrationCategoryKey(sourceKey)
      const sourceTitle = sourceIdentity
        ? getCategoryTitleFromKey(sourceKey)
        : `${entry.discipline} · ${levelLabel(entry.experienceLevel)}`

      if (registered === 'novice') noviceCount += 1
      else if (registered === 'experienced') experiencedCount += 1
      else otherCount += 1

      participants.push({
        name: formatAthleteFullName(entry.athlete),
        registeredLevel: levelLabel(entry.experienceLevel),
        sourceCategoryTitle: sourceTitle,
        paymentStatus: entry.paymentStatus,
      })
    }

    const report: CategoryReport = {
      categoryKey: draw.categoryKey,
      title: getCategoryTitleFromKey(draw.categoryKey),
      count: draw.participants.length,
      noviceCount,
      experiencedCount,
      otherCount,
      participants,
    }

    if (noviceCount === draw.participants.length) allNovice.push(report)
    else if (experiencedCount === draw.participants.length) allExperienced.push(report)
    else mixed.push(report)
  }

  console.log('=== Опытные сетки vs уровень в заявке (только чтение) ===')
  console.log(`Generation: ${generation.id}, version ${generation.version}`)
  console.log(`ACTIVE категорий «Опытные»: ${draws.length}`)
  console.log(`  · все участники заявились новичками: ${allNovice.length}`)
  console.log(`  · смешанные (новички + опытные): ${mixed.length}`)
  console.log(`  · все заявились опытными: ${allExperienced.length}`)

  if (allNovice.length) {
    console.log('\n========== Кандидаты на переименование в «Новички» (100% новички в заявке) ==========')
    for (const cat of allNovice.sort((a, b) => a.title.localeCompare(b.title, 'ru'))) {
      console.log(`\n• ${cat.title} (${cat.count} чел.)`)
      console.log(`  key: ${cat.categoryKey}`)
      for (const p of cat.participants) {
        const eligible = isEntryEligibleForParticipation(p.paymentStatus as EntryPaymentStatus)
        console.log(
          `  - ${p.name} · заявка: ${p.registeredLevel} · ${p.sourceCategoryTitle}${eligible ? '' : ' · НЕ ДОПУЩЕН'}`,
        )
      }
    }
  }

  if (mixed.length) {
    console.log('\n========== Смешанные (переименование спорно) ==========')
    for (const cat of mixed.sort((a, b) => a.title.localeCompare(b.title, 'ru'))) {
      console.log(
        `\n• ${cat.title} (${cat.count} чел.: новичков ${cat.noviceCount}, опытных ${cat.experiencedCount})`,
      )
      console.log(`  key: ${cat.categoryKey}`)
      for (const p of cat.participants) {
        console.log(`  - ${p.name} · заявка: ${p.registeredLevel}`)
      }
    }
  }

  console.log('\n========== Итог ==========')
  if (allNovice.length === 0) {
    console.log('Категорий «Опытные», где ВСЕ участники изначально новички, не найдено.')
  } else {
    console.log(
      `Найдено ${allNovice.length} категорий «Опытные», которые по заявкам логичнее назвать «Новички».`,
    )
    console.log('Изменения не выполнялись — только отчёт.')
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
