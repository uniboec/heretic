#!/usr/bin/env npx tsx
/**
 * Пакет правок организатора: снятие (UNPAID) + переносы.
 * npx tsx scripts/apply-organizer-batch-changes.ts --dry-run
 * npx tsx scripts/apply-organizer-batch-changes.ts
 */
import { prisma } from '../lib/prisma'
import { formatAthleteFullName } from '../lib/registration/athleteName'
import {
  getCategoryTitleFromKey,
  getRegistrationCategoryIdentity,
  getRegistrationCategoryKey,
} from '../lib/registration/categoryIdentity'
import { loadEligibleEntries } from '../lib/brackets/core/eligibility'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { forceRebuildCategories } from '../lib/brackets/live/forceRebuild'
import { acquireBracketWriteLocks } from '../lib/brackets/live/locks'
import { incrementRegistrationRevision } from '../lib/brackets/core/locks'
import { rankTargetCandidates } from '../lib/brackets/consolidation/rankCandidates'
import { isEntryEligibleForParticipation } from '../lib/registration/status'
import type { EntryPaymentStatus } from '../lib/registration/status'

const DRY_RUN = process.argv.includes('--dry-run')

const REMOVE_ATHLETES: Array<{ lastName: string; firstName: string }> = [
  { lastName: 'Гурьева', firstName: 'Анна' },
]

/** Снять только заявки, где спортсмен один в своей категории (с соперниками не трогаем). */
const REMOVE_SINGLETON_ATHLETES: Array<{ lastName: string; firstName: string }> = [
  { lastName: 'Махнев', firstName: 'Виктор' },
]

type MoveSpec = {
  lastName: string
  firstName: string
  discipline: string
  toCategoryKey: string
}

const MOVES: MoveSpec[] = []

function matchesName(
  athlete: { lastName: string; firstName: string },
  spec: { lastName: string; firstName: string },
): boolean {
  return (
    athlete.lastName === spec.lastName &&
    athlete.firstName.startsWith(spec.firstName.slice(0, 4))
  )
}

async function loadDrawCounts(): Promise<Map<string, { title: string; count: number; boutsReleased: boolean }>> {
  const generation = await requireWorkingGeneration(prisma)
  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: generation.id },
    include: {
      participants: { select: { entryId: true } },
      publicationState: { select: { boutsReleased: true } },
    },
  })
  const map = new Map<string, { title: string; count: number; boutsReleased: boolean }>()
  for (const draw of draws) {
    map.set(draw.categoryKey, {
      title: draw.title,
      count: draw.participants.length,
      boutsReleased: draw.publicationState?.boutsReleased ?? false,
    })
  }
  return map
}

async function suggestTargets(
  sourceKey: string,
  virtual: Map<string, string[]>,
): Promise<string[]> {
  const [discipline, experienceLevel] = sourceKey.split(':')
  const rules = await prisma.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })
  const sourceCount = virtual.get(sourceKey)?.length ?? 0
  if (sourceCount === 0) return []

  const candidates = [...virtual.entries()]
    .filter(([key, ids]) => key !== sourceKey && ids.length > 0)
    .filter(([key]) => {
      const parts = key.split(':')
      return parts[0] === discipline && parts[1] === experienceLevel
    })
    .map(([key]) => key)

  return rankTargetCandidates({
    candidates,
    virtual,
    sourceCount,
    incompleteThreshold: 1,
    formatRules: rules,
  }).slice(0, 3)
}

async function resolveMove(
  athletes: Awaited<ReturnType<typeof prisma.athlete.findMany<{ include: { entries: true } }>>>,
  spec: MoveSpec,
) {
  const athlete = athletes.find((a) => matchesName(a, spec))
  if (!athlete) throw new Error(`Не найден для переноса: ${spec.lastName} ${spec.firstName}`)

  const entry = athlete.entries.find((e) => e.discipline === spec.discipline)
  if (!entry) {
    throw new Error(`Нет заявки ${spec.discipline} у ${spec.lastName} ${spec.firstName}`)
  }
  if (!isEntryEligibleForParticipation(entry.paymentStatus as EntryPaymentStatus)) {
    throw new Error(
      `${spec.lastName} ${spec.firstName} не допущен (${entry.paymentStatus}) — перенос невозможен`,
    )
  }

  const placement = await prisma.bracketEntryPlacement.findUnique({ where: { entryId: entry.id } })
  const identity = getRegistrationCategoryIdentity(entry, athlete)
  const fromCategoryKey =
    placement?.categoryKey ??
    (identity ? getRegistrationCategoryKey(identity) : null)

  if (!fromCategoryKey) {
    throw new Error(`Не удалось определить исходную категорию: ${spec.lastName}`)
  }
  if (fromCategoryKey === spec.toCategoryKey) {
    throw new Error(
      `${spec.lastName} уже в ${getCategoryTitleFromKey(spec.toCategoryKey)}`,
    )
  }

  return { athlete, entry, fromCategoryKey, toCategoryKey: spec.toCategoryKey }
}

async function applyMove(
  move: Awaited<ReturnType<typeof resolveMove>>,
): Promise<{ id: string; version: number }> {
  let draft = await requireWorkingGeneration(prisma)

  return prisma.$transaction(async (tx) => {
    const ctx = await acquireBracketWriteLocks(tx, { scope: 'destructive_admin' })
    if (ctx.generation.id !== draft.id || ctx.generation.version !== draft.version) {
      throw new Error('Версия сеток изменилась')
    }

    await tx.bracketEntryPlacement.upsert({
      where: { entryId: move.entry.id },
      create: {
        entryId: move.entry.id,
        categoryKey: move.toCategoryKey,
        isManualMove: true,
        movedAt: new Date(),
      },
      update: {
        categoryKey: move.toCategoryKey,
        isManualMove: true,
        movedAt: new Date(),
      },
    })

    await tx.bracketMoveAudit.create({
      data: {
        entryId: move.entry.id,
        action: 'MOVE',
        fromCategoryKey: move.fromCategoryKey,
        toCategoryKey: move.toCategoryKey,
        movedBy: 'script:apply-organizer-batch-changes',
      },
    })

    await forceRebuildCategories(tx, {
      generationId: ctx.generation.id,
      categoryKeys: [move.fromCategoryKey, move.toCategoryKey],
      preserveVisible: true,
    })

    const updated = await tx.bracketGeneration.update({
      where: { id: ctx.generation.id },
      data: { version: ctx.generation.version + 1 },
    })
    return { id: updated.id, version: updated.version }
  })
}

async function main() {
  const athletes = await prisma.athlete.findMany({ include: { entries: true } })

  const removeEntryIds: string[] = []
  const removeLabels: string[] = []

  for (const spec of REMOVE_ATHLETES) {
    const found = athletes.filter((a) => matchesName(a, spec))
    if (found.length === 0) {
      console.warn(`⚠ Не найден: ${spec.lastName} ${spec.firstName}`)
      continue
    }
    for (const athlete of found) {
      for (const entry of athlete.entries) {
        if (!isEntryEligibleForParticipation(entry.paymentStatus as EntryPaymentStatus)) continue
        removeEntryIds.push(entry.id)
        removeLabels.push(
          `${formatAthleteFullName(athlete)} · ${entry.discipline} · ${entry.paymentStatus}`,
        )
      }
    }
  }

  const settings = (await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })) ?? {
    includePaid: true,
    includeUnpaid: false,
  }

  const eligible = await loadEligibleEntries(settings)
  const keepLabels: string[] = []

  for (const spec of REMOVE_SINGLETON_ATHLETES) {
    const found = athletes.filter((a) => matchesName(a, spec))
    if (found.length === 0) {
      console.warn(`⚠ Не найден (singleton): ${spec.lastName} ${spec.firstName}`)
      continue
    }
    for (const athlete of found) {
      for (const entry of athlete.entries) {
        if (!isEntryEligibleForParticipation(entry.paymentStatus as EntryPaymentStatus)) continue
        const e = eligible.find((x) => x.entryId === entry.id)
        if (!e) continue
        const inCategory = eligible.filter((x) => x.effectiveCategoryKey === e.effectiveCategoryKey)
        const title = getCategoryTitleFromKey(e.effectiveCategoryKey)
        if (inCategory.length > 1) {
          keepLabels.push(
            `${formatAthleteFullName(athlete)} · ${entry.discipline} · ${title} (${inCategory.length} уч.)`,
          )
          continue
        }
        if (removeEntryIds.includes(entry.id)) continue
        removeEntryIds.push(entry.id)
        removeLabels.push(
          `${formatAthleteFullName(athlete)} · ${entry.discipline} · ${title} · один в категории`,
        )
      }
    }
  }

  const resolvedMoves = await Promise.all(MOVES.map((spec) => resolveMove(athletes, spec)))
  const virtualBefore = new Map<string, string[]>()
  for (const e of eligible) {
    const list = virtualBefore.get(e.effectiveCategoryKey) ?? []
    list.push(e.entryId)
    virtualBefore.set(e.effectiveCategoryKey, list)
  }

  const drawCountsBefore = await loadDrawCounts()
  const affectedKeys = new Set<string>()

  for (const entryId of removeEntryIds) {
    const e = eligible.find((x) => x.entryId === entryId)
    if (e) affectedKeys.add(e.effectiveCategoryKey)
    const p = await prisma.bracketDrawParticipant.findFirst({
      where: { entryId },
      include: { draw: { select: { categoryKey: true } } },
    })
    if (p) affectedKeys.add(p.draw.categoryKey)
  }

  for (const move of resolvedMoves) {
    affectedKeys.add(move.fromCategoryKey)
    affectedKeys.add(move.toCategoryKey)
  }

  const virtualAfter = new Map<string, string[]>()
  for (const [key, ids] of virtualBefore) {
    virtualAfter.set(key, [...ids])
  }

  for (const entryId of removeEntryIds) {
    for (const [key, ids] of virtualAfter) {
      virtualAfter.set(
        key,
        ids.filter((id) => id !== entryId),
      )
    }
  }

  for (const move of resolvedMoves) {
    const fromList = virtualAfter.get(move.fromCategoryKey) ?? []
    virtualAfter.set(
      move.fromCategoryKey,
      fromList.filter((id) => id !== move.entry.id),
    )
    const toList = virtualAfter.get(move.toCategoryKey) ?? []
    if (!toList.includes(move.entry.id)) {
      toList.push(move.entry.id)
      virtualAfter.set(move.toCategoryKey, toList)
    }
  }

  console.log('\n=== Снять (→ Не оплачен) ===')
  for (const label of removeLabels) console.log(`  • ${label}`)
  console.log(`  Заявок к снятию: ${removeEntryIds.length}`)

  if (keepLabels.length > 0) {
    console.log('\n=== Оставить (есть соперники) ===')
    for (const label of keepLabels) console.log(`  • ${label}`)
  }

  console.log('\n=== Переносы ===')
  for (const move of resolvedMoves) {
    console.log(
      `  • ${formatAthleteFullName(move.athlete)}: ${getCategoryTitleFromKey(move.fromCategoryKey)} → ${getCategoryTitleFromKey(move.toCategoryKey)}`,
    )
  }

  console.log('\n=== Затронутые сетки ===')
  for (const key of [...affectedKeys].sort()) {
    const before = drawCountsBefore.get(key)
    const beforeCount = before?.count ?? (virtualBefore.get(key)?.length ?? 0)
    const afterCount = (virtualAfter.get(key) ?? []).length
    const title = getCategoryTitleFromKey(key)
    const bouts = before?.boutsReleased ? ' · в поединках' : ''
    console.log(`  • ${title}${bouts}\n    было ${beforeCount} → станет ${afterCount}`)
  }

  console.log('\n=== Останутся одни из-за этих изменений ===')
  let newSingletonCount = 0
  for (const key of [...affectedKeys].sort()) {
    const beforeCount = (virtualBefore.get(key) ?? []).length
    const afterIds = virtualAfter.get(key) ?? []
    if (afterIds.length !== 1) continue
    if (beforeCount <= 1) continue

    newSingletonCount += 1
    const names = afterIds
      .map((id) => eligible.find((e) => e.entryId === id)?.displayName ?? id)
      .join(', ')
    const suggestions = await suggestTargets(key, virtualAfter)
    console.log(`  • ${getCategoryTitleFromKey(key)} — ${names}`)
    if (suggestions.length > 0) {
      console.log(
        `    Ближайшие варианты: ${suggestions.map((s) => getCategoryTitleFromKey(s)).join('; ')}`,
      )
    } else {
      console.log('    Ближайшие варианты: нет подходящих категорий той же дисциплины/уровня')
    }
  }
  if (newSingletonCount === 0) console.log('  (нет — никто не останется один из-за этих правок)')

  console.log('\n=== Категории опустеют ===')
  let emptyCount = 0
  for (const key of [...affectedKeys].sort()) {
    const beforeCount = (virtualBefore.get(key) ?? []).length
    const afterCount = (virtualAfter.get(key) ?? []).length
    if (beforeCount > 0 && afterCount === 0) {
      emptyCount += 1
      console.log(`  • ${getCategoryTitleFromKey(key)} (было ${beforeCount})`)
    }
  }
  if (emptyCount === 0) console.log('  (нет)')

  if (DRY_RUN) {
    console.log('\n[dry-run] Изменения не применены.')
    return
  }

  const generation = await requireWorkingGeneration(prisma)

  await prisma.$transaction(async (tx) => {
    await acquireBracketWriteLocks(tx, { scope: 'destructive_admin' })

    for (const entryId of removeEntryIds) {
      await tx.athleteEntry.update({
        where: { id: entryId },
        data: { paymentStatus: 'UNPAID', paidAt: null, paymentStage: null },
      })
    }

    await incrementRegistrationRevision(tx)

    const rebuildKeys = [...affectedKeys]
    if (rebuildKeys.length > 0) {
      await forceRebuildCategories(tx, {
        generationId: generation.id,
        categoryKeys: rebuildKeys,
        preserveVisible: true,
      })
    }

    await tx.bracketGeneration.update({
      where: { id: generation.id },
      data: { version: generation.version + 1 },
    })
  })

  let draft = await requireWorkingGeneration(prisma)
  for (const move of resolvedMoves) {
    draft = await applyMove(move)
  }

  console.log('\n✓ Изменения применены. Версия сеток:', draft.version)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
