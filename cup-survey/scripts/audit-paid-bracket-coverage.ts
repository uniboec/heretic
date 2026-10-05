#!/usr/bin/env npx tsx
/**
 * Read-only audit: participation-eligible entries vs brackets vs bouts.
 * npx tsx scripts/audit-paid-bracket-coverage.ts
 */
import { prisma } from '../lib/prisma'
import { loadEligibleEntries } from '../lib/brackets/core/eligibility'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { getActivePublishedGeneration, getBoutsReleasedPublishedDraws } from '../lib/brackets/generation/publishedDraws'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import { formatAthleteFullName } from '../lib/registration/athleteName'
import {
  isEntryEligibleForParticipation,
  isEntryFinanciallySettled,
  type EntryPaymentStatus,
} from '../lib/registration/status'
import { categoryRequiresBouts } from '../lib/brackets/core/categoryRequiresBouts'
import { extractPlayableBoutsForPair } from '../lib/bouts/extractForPair'
import { computeDiffForDraft } from '../lib/brackets/dashboardDiff'

type DrawIndex = Map<
  string,
  {
    categoryKey: string
    title: string
    participantIds: Set<string>
    boutsReleased: boolean
    publicVisible: boolean
    status: string
    participantCount: number
    autoSystemId: string | null
    systemOverride: string | null
  }
>

function buildDrawIndex(
  draws: Array<{
    categoryKey: string
    title: string
    status: string
    autoSystemId: string | null
    systemOverride: string | null
    participants: Array<{ entryId: string }>
    publicationState: { boutsReleased: boolean; visible: boolean } | null
  }>,
): DrawIndex {
  const map: DrawIndex = new Map()
  for (const draw of draws) {
    map.set(draw.categoryKey, {
      categoryKey: draw.categoryKey,
      title: draw.title,
      participantIds: new Set(draw.participants.map((p) => p.entryId)),
      boutsReleased: draw.publicationState?.boutsReleased ?? false,
      publicVisible: draw.publicationState?.visible ?? false,
      status: draw.status,
      participantCount: draw.participants.length,
      autoSystemId: draw.autoSystemId,
      systemOverride: draw.systemOverride,
    })
  }
  return map
}

function paymentLabel(status: EntryPaymentStatus): string {
  switch (status) {
    case 'PAID':
      return 'Оплачен'
    case 'ADMITTED_WITHOUT_PAYMENT':
      return 'Допущен без оплаты'
    case 'DEBT':
      return 'Долг'
    default:
      return status
  }
}

async function loadDrawsForGeneration(generationId: string) {
  return prisma.bracketCategoryDraw.findMany({
    where: { generationId, status: 'ACTIVE' },
    include: {
      participants: { select: { entryId: true } },
      publicationState: { select: { boutsReleased: true, visible: true } },
    },
  })
}

async function auditGeneration(
  label: string,
  generationId: string,
  eligible: Awaited<ReturnType<typeof loadEligibleEntries>>,
) {
  const draws = await loadDrawsForGeneration(generationId)
  const byCategory = buildDrawIndex(draws)

  const entryToDrawKey = new Map<string, string>()
  for (const draw of draws) {
    for (const p of draw.participants) {
      entryToDrawKey.set(p.entryId, draw.categoryKey)
    }
  }

  const missingFromBracket: string[] = []
  const wrongCategory: string[] = []
  const ok: string[] = []

  for (const e of eligible) {
    const expected = e.effectiveCategoryKey
    const expectedTitle = getCategoryTitleFromKey(expected)
    const draw = byCategory.get(expected)
    const inExpected = draw?.participantIds.has(e.entryId) ?? false
    const actualKey = entryToDrawKey.get(e.entryId)

    const line = `${e.displayName} · ${e.discipline} · ${paymentLabel(e.paymentStatus as EntryPaymentStatus)} · ${expectedTitle}`

    if (!inExpected && !actualKey) {
      missingFromBracket.push(`  ! Нет в сетке: ${line}`)
      continue
    }
    if (!inExpected && actualKey) {
      wrongCategory.push(
        `  ! Другая категория: ${line}\n    ожидалось: ${expectedTitle}\n    фактически: ${getCategoryTitleFromKey(actualKey)}`,
      )
      continue
    }
    ok.push(`  ✓ ${line}`)
  }

  const ghosts: string[] = []
  const eligibleIds = new Set(eligible.map((e) => e.entryId))
  for (const draw of draws) {
    for (const p of draw.participants) {
      if (eligibleIds.has(p.entryId)) continue
      const entry = await prisma.athleteEntry.findUnique({
        where: { id: p.entryId },
        include: { athlete: true },
      })
      const name = entry
        ? formatAthleteFullName(entry.athlete)
        : p.entryId.slice(0, 8)
      const status = entry?.paymentStatus ?? '?'
      ghosts.push(
        `  ! В сетке без допуска: ${name} · ${draw.title} · статус ${status}`,
      )
    }
  }

  console.log(`\n========== ${label} ==========`)
  console.log(`Допущено к участию: ${eligible.length}`)
  console.log(`Категорий ACTIVE: ${draws.length}`)
  console.log(`Участников в сетках: ${draws.reduce((n, d) => n + d.participants.length, 0)}`)

  if (missingFromBracket.length) {
    console.log(`\n--- Не попали в ожидаемую сетку (${missingFromBracket.length}) ---`)
    missingFromBracket.forEach((l) => console.log(l))
  }
  if (wrongCategory.length) {
    console.log(`\n--- В другой категории (${wrongCategory.length}) ---`)
    wrongCategory.forEach((l) => console.log(l))
  }
  if (ghosts.length) {
    console.log(`\n--- Лишние в сетках (не допущены) (${ghosts.length}) ---`)
    ghosts.forEach((l) => console.log(l))
  }

  const issues = missingFromBracket.length + wrongCategory.length + ghosts.length
  if (issues === 0) {
    console.log('\n✓ Расхождений по составу сеток не найдено.')
  }

  return { missingFromBracket, wrongCategory, ghosts, byCategory, draws }
}

async function auditBouts(
  eligible: Awaited<ReturnType<typeof loadEligibleEntries>>,
) {
  const published = await getActivePublishedGeneration()
  if (!published) {
    console.log('\n========== Поединки ==========')
    console.log('Нет опубликованной версии сеток.')
    return
  }

  const pairs = await getBoutsReleasedPublishedDraws(published)
  console.log(`\n========== Поединки (опубликовано, boutsReleased) ==========`)
  console.log(`Категорий в расписании: ${pairs.length}`)

  const eligibleIds = new Set(eligible.map((e) => e.entryId))
  const missingFromBouts: string[] = []
  const inBoutsNotEligible: string[] = []

  for (const pair of pairs) {
    const draw = pair.draw
    const requiresBouts = categoryRequiresBouts({
      status: draw.status,
      autoSystemId: draw.autoSystemId,
      systemOverride: draw.systemOverride,
      participantCount: draw.participants.length,
    })
    if (!requiresBouts) continue

    const bouts = extractPlayableBoutsForPair(pair)
    const entryIdsInBouts = new Set<string>()
    for (const bout of bouts) {
      if (bout.sideA.kind === 'athlete') entryIdsInBouts.add(bout.sideA.entryId)
      if (bout.sideB.kind === 'athlete') entryIdsInBouts.add(bout.sideB.entryId)
    }

    for (const p of draw.participants) {
      if (!eligibleIds.has(p.entryId)) continue
      if (entryIdsInBouts.has(p.entryId)) continue
      const entry = await prisma.athleteEntry.findUnique({
        where: { id: p.entryId },
        include: { athlete: true },
      })
      missingFromBouts.push(
        `  ! В сетке и расписании категории, но не в поединках: ${entry ? formatAthleteFullName(entry.athlete) : p.entryId} · ${draw.title}`,
      )
    }

    for (const entryId of entryIdsInBouts) {
      if (eligibleIds.has(entryId)) continue
      inBoutsNotEligible.push(
        `  ! В поединках без допуска: ${entryId.slice(0, 8)}… · ${draw.title}`,
      )
    }
  }

  if (missingFromBouts.length) {
    console.log(`\n--- Допущенные не найдены в поединках (${missingFromBouts.length}) ---`)
    missingFromBouts.forEach((l) => console.log(l))
  }
  if (inBoutsNotEligible.length) {
    console.log(`\n--- Поединки с недопущенными (${inBoutsNotEligible.length}) ---`)
    inBoutsNotEligible.forEach((l) => console.log(l))
  }
  if (!missingFromBouts.length && !inBoutsNotEligible.length) {
    console.log('\n✓ В выпущенных категориях все допущенные участники есть в поединках.')
  }
}

async function auditStaleFlags(generationId: string) {
  const diff = await computeDiffForDraft(generationId)
  if (!diff.globalCompositionStale && !diff.registrationDataStale) return

  console.log('\n========== Флаги синхронизации ==========')
  if (diff.globalCompositionStale) {
    console.log('  ⚠ Состав сеток устарел (globalCompositionStale) — после ручных правок нужна синхронизация.')
  }
  if (diff.registrationDataStale) {
    console.log('  ⚠ Регистрационные данные изменились (registrationDataStale).')
  }
  const staleCats = Object.entries(diff.categories).filter(
    ([, c]) => c.compositionStale || c.seedingStale,
  )
  if (staleCats.length) {
    console.log(`  ⚠ Категорий с устаревшей жеребьёвкой/составом: ${staleCats.length}`)
  }
}

async function main() {
  const settings = (await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })) ?? {
    includePaid: true,
    includeUnpaid: false,
  }

  const allEligible = await loadEligibleEntries(settings)
  const strictlyPaid = allEligible.filter((e) => e.paymentStatus === 'PAID')
  const financiallySettled = allEligible.filter((e) =>
    isEntryFinanciallySettled(e.paymentStatus as EntryPaymentStatus),
  )

  console.log('=== Сводка по оплате (допуск к сеткам) ===')
  console.log(`Всего допущено (PAID + допущен + долг): ${allEligible.length}`)
  console.log(`  · PAID (оплачен): ${strictlyPaid.length}`)
  console.log(`  · ADMITTED_WITHOUT_PAYMENT: ${allEligible.filter((e) => e.paymentStatus === 'ADMITTED_WITHOUT_PAYMENT').length}`)
  console.log(`  · DEBT: ${allEligible.filter((e) => e.paymentStatus === 'DEBT').length}`)
  console.log(`Финансово закрыто (PAID + допущен): ${financiallySettled.length}`)

  const working = await requireWorkingGeneration(prisma)
  await auditStaleFlags(working.id)
  await auditGeneration('Рабочие сетки (ACTIVE)', working.id, allEligible)

  const published = await getActivePublishedGeneration()
  if (published && published.id !== working.id) {
    await auditGeneration('Опубликованные сетки (PUBLIC)', published.id, allEligible)
    console.log('\n  ℹ Рабочая и опубликованная версии различаются — возможны расхождения на сайте до публикации.')
  } else if (published) {
    console.log('\n  ℹ Рабочая версия совпадает с опубликованной.')
  }

  await auditBouts(allEligible)

  // Multi-entry athletes: each eligible entry should map to a bracket
  console.log('\n========== Спортсмены с несколькими допущенными заявками ==========')
  const byAthlete = new Map<string, typeof allEligible>()
  for (const e of allEligible) {
    const reg = await prisma.athleteEntry.findUnique({
      where: { id: e.entryId },
      select: { athleteId: true },
    })
    if (!reg) continue
    const list = byAthlete.get(reg.athleteId) ?? []
    list.push(e)
    byAthlete.set(reg.athleteId, list)
  }
  let multiIssues = 0
  for (const [, entries] of byAthlete) {
    if (entries.length < 2) continue
    const workingDraws = await loadDrawsForGeneration(working.id)
    const entryToCat = new Map<string, string>()
    for (const d of workingDraws) {
      for (const p of d.participants) entryToCat.set(p.entryId, d.categoryKey)
    }
    const covered = entries.filter((e) => entryToCat.has(e.entryId))
    if (covered.length !== entries.length) {
      multiIssues += 1
      console.log(`  ${entries[0].displayName}: ${entries.length} заявок, в сетках ${covered.length}`)
      for (const e of entries) {
        const cat = entryToCat.get(e.entryId)
        console.log(
          `    · ${e.discipline} → ${cat ? getCategoryTitleFromKey(cat) : 'НЕТ В СЕТКЕ'} (${paymentLabel(e.paymentStatus as EntryPaymentStatus)})`,
        )
      }
    }
  }
  if (multiIssues === 0) {
    console.log('  ✓ У всех спортсменов с 2+ заявками каждая заявка есть в своей сетке.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
