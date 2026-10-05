/**
 * Ручная группировка опытных категорий по списку организатора,
 * оплата сестёр Гурьевых (ранняя регистрация), публикация и выпуск на площадку.
 *
 * Запуск:
 *   npx tsx scripts/apply-experienced-bracket-groups.ts --dry-run
 *   npx tsx scripts/apply-experienced-bracket-groups.ts
 */
import { prisma } from '../lib/prisma'
import { getRegistrationCategoryKey, getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import { ensureDraftExists } from '../lib/brackets/generation/ensureDraft'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { redrawBracketDraft } from '../lib/brackets/generation/redraw'
import { publishBracketDraft } from '../lib/brackets/generation/publish'
import { setCategoriesBoutsReleased } from '../lib/bouts/release'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'
import { forceRebuildCategories } from '../lib/brackets/live/forceRebuild'
import { acquireBracketWriteLocks } from '../lib/brackets/live/locks'
import { loadEligibleEntries } from '../lib/brackets/core/eligibility'
import { syncRegistrationTotals } from '../lib/registration/entryPayment'
import { getRegistrationScheduleSync } from '../lib/registration/schedule'
import { resolveEntryPrice } from '../lib/registration/pricing'
import { listActiveCategoryDiscountRules } from '../lib/registration/categoryDiscounts'

const DRY_RUN = process.argv.includes('--dry-run')
const SKIP_PAYMENTS = process.argv.includes('--skip-payments')

type GroupSpec = {
  discipline: 'tactic_control' | 'close_control'
  ageDivisionId: string
  weightCategoryId: string
  athletes: string[]
}

const EXPERIENCED = 'experienced' as const
const EARLY_STAGE_ID = 'early'

function targetKey(spec: Pick<GroupSpec, 'discipline' | 'ageDivisionId' | 'weightCategoryId'>) {
  return getRegistrationCategoryKey({
    discipline: spec.discipline,
    experienceLevel: EXPERIENCED,
    ageDivisionId: spec.ageDivisionId,
    weightCategoryId: spec.weightCategoryId,
  })
}

/** Список организатора (сетки 2+). Чемпионы без пары — не включаем. */
const GROUPS: GroupSpec[] = [
  // ТАКТИК — МУЖЧИНЫ
  { discipline: 'tactic_control', ageDivisionId: 'm_boys_1', weightCategoryId: 'm_boys_1_w_le_20', athletes: ['Кузмин Мирон', 'Устюгов Владимир'] },
  { discipline: 'tactic_control', ageDivisionId: 'm_boys_2', weightCategoryId: 'm_boys_2_w_le_29', athletes: ['Бурлаков Артём', 'Цыкарев Данил'] },
  { discipline: 'tactic_control', ageDivisionId: 'm_boys_3', weightCategoryId: 'm_boys_3_w_le_29', athletes: ['Саляхов Марк', 'Гусев Артём', 'Оберман Григорий', 'Хафизов Радмир'] },
  { discipline: 'tactic_control', ageDivisionId: 'm_boys_3', weightCategoryId: 'm_boys_3_w_le_32', athletes: ['Петухов Степан', 'Куликов Демид', 'Латаев Григорий'] },
  { discipline: 'tactic_control', ageDivisionId: 'm_boys_3', weightCategoryId: 'm_boys_3_w_le_41', athletes: ['Лысенко Владимир', 'Махнев Виктор'] },
  { discipline: 'tactic_control', ageDivisionId: 'm_youths_1', weightCategoryId: 'm_youths_1_w_le_32', athletes: ['Сергеев Вадим', 'Двойнишников Егор', 'Ахматзакиров Дамир'] },
  { discipline: 'tactic_control', ageDivisionId: 'm_youths_1', weightCategoryId: 'm_youths_1_w_le_35', athletes: ['Потапов Георгий', 'Зиннатулин Мирон'] },
  { discipline: 'tactic_control', ageDivisionId: 'm_youths_2', weightCategoryId: 'm_youths_2_w_le_38', athletes: ['Соколов Егор', 'Скрябин Константин', 'Самиев Виктор'] },
  { discipline: 'tactic_control', ageDivisionId: 'm_youths_2', weightCategoryId: 'm_youths_2_w_le_48', athletes: ['Романов Арсений', 'Нурмахмадов Мунис', 'Лан Богдан'] },
  { discipline: 'tactic_control', ageDivisionId: 'm_youths_2', weightCategoryId: 'm_youths_2_w_le_61', athletes: ['Рассветаев Андрей', 'Латаев Гардей'] },
  { discipline: 'tactic_control', ageDivisionId: 'm_youths_3', weightCategoryId: 'm_youths_3_w_le_52', athletes: ['Мавликаев Даниил', 'Нурмахматов Муслим'] },
  { discipline: 'tactic_control', ageDivisionId: 'm_youths_3', weightCategoryId: 'm_youths_3_w_le_66', athletes: ['Ахтямов Артём', 'Сумцов Всеволод'] },

  // ТАКТИК — ДЕВОЧКИ
  { discipline: 'tactic_control', ageDivisionId: 'f_girls_2', weightCategoryId: 'f_girls_2_w_le_26', athletes: ['Очур-Оол Анита', 'Пироженко Дарья', 'Цыкарева Ларина'] },
  { discipline: 'tactic_control', ageDivisionId: 'f_girls_youth_1', weightCategoryId: 'f_girls_youth_1_w_le_38', athletes: ['Ахтямова Есения', 'Гурьева Дарья', 'Строина Виктория'] },
  { discipline: 'tactic_control', ageDivisionId: 'f_girls_youth_2', weightCategoryId: 'f_girls_youth_2_w_le_44', athletes: ['Куркина Олеся', 'Самиева София'] },
  { discipline: 'tactic_control', ageDivisionId: 'f_girls_youth_3', weightCategoryId: 'f_girls_youth_3_w_le_52', athletes: ['Ракова Алиса', 'Оберман Вероника'] },

  // КЛОУС — МУЖЧИНЫ
  { discipline: 'close_control', ageDivisionId: 'm_boys_1', weightCategoryId: 'm_boys_1_w_le_20', athletes: ['Кузмин Мирон', 'Устюгов Владимир'] },
  { discipline: 'close_control', ageDivisionId: 'm_boys_3', weightCategoryId: 'm_boys_3_w_le_29', athletes: ['Цыкарев Данил', 'Гусев Артём'] },
  { discipline: 'close_control', ageDivisionId: 'm_boys_3', weightCategoryId: 'm_boys_3_w_le_32', athletes: ['Куликов Демид', 'Петухов Степан'] },
  { discipline: 'close_control', ageDivisionId: 'm_boys_3', weightCategoryId: 'm_boys_3_w_le_41', athletes: ['Лысенко Владимир', 'Махнев Виктор'] },
  { discipline: 'close_control', ageDivisionId: 'm_youths_1', weightCategoryId: 'm_youths_1_w_le_35', athletes: ['Сергеев Вадим', 'Потапов Георгий'] },
  { discipline: 'close_control', ageDivisionId: 'm_youths_1', weightCategoryId: 'm_youths_1_w_le_41', athletes: ['Россошных Александр', 'Сухорослов Ярослав'] },
  { discipline: 'close_control', ageDivisionId: 'm_youths_2', weightCategoryId: 'm_youths_2_w_le_38', athletes: ['Скрябин Константин', 'Соколов Егор', 'Самиев Виктор'] },
  { discipline: 'close_control', ageDivisionId: 'm_youths_2', weightCategoryId: 'm_youths_2_w_le_48', athletes: ['Панов Роман', 'Бахтин Егор'] },
  { discipline: 'close_control', ageDivisionId: 'm_juniors_1', weightCategoryId: 'm_juniors_1_w_le_48', athletes: ['Абдураимов Самаджон', 'Одинаев Дамин', 'Амирбеков Хурщедджон'] },
  { discipline: 'close_control', ageDivisionId: 'm_youths_3', weightCategoryId: 'm_youths_3_w_le_66', athletes: ['Волосников Гордей', 'Трубеев Никита'] },
  { discipline: 'close_control', ageDivisionId: 'm_juniors_1', weightCategoryId: 'm_juniors_1_w_gt_71', athletes: ['Кузнецов Александр', 'Федоров Ярослав', 'Левченко Сергей'] },
  { discipline: 'close_control', ageDivisionId: 'm_men_1', weightCategoryId: 'm_men_1_w_le_71', athletes: ['Лазуков Александр', 'Филатов Сергей'] },

  // КЛОУС — ДЕВОЧКИ
  { discipline: 'close_control', ageDivisionId: 'f_girls_2', weightCategoryId: 'f_girls_2_w_le_26', athletes: ['Очур-Оол Анита', 'Пироженко Дарья', 'Цыкарева Ларина'] },
  { discipline: 'close_control', ageDivisionId: 'f_girls_youth_2', weightCategoryId: 'f_girls_youth_2_w_le_44', athletes: ['Куркина Олеся', 'Самиева София'] },
]

const GURIEVA_EARLY_PAYMENT = ['Гурьева Анна', 'Гурьева Дарья']

function parseAthleteName(full: string) {
  const [lastName, firstName] = full.split(' ')
  return { lastName, firstName }
}

async function markGurievaEarlyPayments() {
  const schedule = getRegistrationScheduleSync()
  const earlyPrice = schedule.stagesById[EARLY_STAGE_ID]?.pricePerDiscipline
  if (earlyPrice == null) throw new Error('early registration stage missing in schedule')

  const discountRules = await listActiveCategoryDiscountRules()
  const athletes = await prisma.athlete.findMany({
    where: { lastName: 'Гурьева' },
    include: {
      entries: true,
      registration: { include: { club: true } },
    },
  })

  const targets = athletes.filter((a) =>
    GURIEVA_EARLY_PAYMENT.some((name) => {
      const { lastName, firstName } = parseAthleteName(name)
      return a.lastName === lastName && a.firstName.startsWith(firstName)
    }),
  )

  if (targets.length === 0) {
    console.log('Сестры Гурьевы не найдены в базе.')
    return
  }

  const paidAt = new Date('2026-09-22T12:00:00.000Z')
  let updatedEntries = 0

  for (const athlete of targets) {
    for (const entry of athlete.entries) {
      const price = resolveEntryPrice(
        earlyPrice,
        {
          discipline: entry.discipline,
          experienceLevel: entry.experienceLevel,
          ageDivisionId: entry.ageDivisionId,
        },
        discountRules,
        athlete.registration.club?.discountPercent ?? null,
      )

      if (DRY_RUN) {
        console.log(
          `  [dry-run] PAID early: ${athlete.lastName} ${athlete.firstName} · ${entry.discipline} · ${price} ₽`,
        )
        continue
      }

      await prisma.athleteEntry.update({
        where: { id: entry.id },
        data: {
          paymentStatus: 'PAID',
          paymentStage: EARLY_STAGE_ID,
          price,
          paidAt,
        },
      })
      updatedEntries += 1
    }

    if (!DRY_RUN) {
      await syncRegistrationTotals(athlete.registrationId)
    }
  }

  console.log(`Оплата (ранняя): ${targets.map((a) => `${a.lastName} ${a.firstName}`).join(', ')} — ${updatedEntries} категорий`)
}

async function resolveMoves() {
  const athletes = await prisma.athlete.findMany({
    include: {
      entries: {
        where: { paymentStatus: { in: ['PAID', 'ADMITTED_WITHOUT_PAYMENT', 'DEBT'] } },
      },
    },
  })

  const moves: Array<{ entryId: string; targetCategoryKey: string; athleteName: string; title: string }> = []
  const warnings: string[] = []

  for (const group of GROUPS) {
    const key = targetKey(group)
    const title = getCategoryTitleFromKey(key)

    for (const athleteName of group.athletes) {
      const { lastName, firstName } = parseAthleteName(athleteName)
      const matches = athletes.filter(
        (a) => a.lastName === lastName && a.firstName.startsWith(firstName),
      )
      if (matches.length === 0) {
        warnings.push(`Не найден (или не оплачен): ${athleteName} (${title})`)
        continue
      }

      const disciplineEntries = matches.flatMap((athlete) =>
        athlete.entries
          .filter((e) => e.discipline === group.discipline)
          .map((entry) => ({ athlete, entry })),
      )
      if (disciplineEntries.length === 0) {
        warnings.push(`Нет оплаченной заявки ${group.discipline}: ${athleteName}`)
        continue
      }

      const picked =
        disciplineEntries.find(({ entry }) => entry.experienceLevel === EXPERIENCED) ??
        disciplineEntries.sort((a, b) =>
          a.entry.experienceLevel.localeCompare(b.entry.experienceLevel),
        )[0]

      moves.push({
        entryId: picked.entry.id,
        targetCategoryKey: key,
        athleteName: `${picked.athlete.lastName} ${picked.athlete.firstName}`,
        title,
      })
    }
  }

  return { moves, warnings }
}

async function applyMoves(moves: Awaited<ReturnType<typeof resolveMoves>>['moves']) {
  let draft = await ensureDraftExists()

  const synced = await syncBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
  })
  draft = synced.draft

  const redrawn = await redrawBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
  })
  draft = redrawn.draft

  const eligible = await loadEligibleEntries({ includePaid: true, includeUnpaid: false })
  const sourceKeys = new Set<string>()
  const targetKeys = new Set<string>()

  for (const move of moves) {
    const entry = eligible.find((e) => e.entryId === move.entryId)
    if (entry) sourceKeys.add(entry.effectiveCategoryKey)
    targetKeys.add(move.targetCategoryKey)
    console.log(`  → ${move.athleteName} → ${move.title}`)
  }

  const affectedCategoryKeys = [...new Set([...sourceKeys, ...targetKeys])]

  draft = await prisma.$transaction(async (tx) => {
    const ctx = await acquireBracketWriteLocks(tx, { scope: 'destructive_admin' })
    if (ctx.generation.id !== draft.id || ctx.generation.version !== draft.version) {
      throw new Error('Версия черновика изменилась во время переноса')
    }

    for (const move of moves) {
      await tx.bracketEntryPlacement.upsert({
        where: { entryId: move.entryId },
        create: {
          entryId: move.entryId,
          categoryKey: move.targetCategoryKey,
          isManualMove: true,
          movedAt: new Date(),
        },
        update: {
          categoryKey: move.targetCategoryKey,
          isManualMove: true,
          movedAt: new Date(),
        },
      })

      const entry = eligible.find((e) => e.entryId === move.entryId)
      await tx.bracketMoveAudit.create({
        data: {
          entryId: move.entryId,
          action: 'MOVE',
          fromCategoryKey: entry?.sourceCategoryKey ?? move.targetCategoryKey,
          toCategoryKey: move.targetCategoryKey,
          movedBy: 'script:apply-experienced-bracket-groups',
        },
      })
    }

    await forceRebuildCategories(tx, {
      generationId: ctx.generation.id,
      categoryKeys: affectedCategoryKeys,
      preserveVisible: true,
    })

    const updated = await tx.bracketGeneration.update({
      where: { id: ctx.generation.id },
      data: { version: ctx.generation.version + 1 },
    })

    return { id: updated.id, version: updated.version }
  })

  return draft
}

async function rebuildSingletons(generationId: string) {
  await prisma.$transaction(async (tx) => {
    await acquireBracketWriteLocks(tx, { scope: 'destructive_admin' })
    const draws = await tx.bracketCategoryDraw.findMany({
      where: { generationId, status: 'ACTIVE' },
      include: { participants: true },
    })
    const singletonKeys = draws
      .filter((d) => d.participants.length === 1)
      .map((d) => d.categoryKey)
    if (singletonKeys.length > 0) {
      await forceRebuildCategories(tx, {
        generationId,
        categoryKeys: singletonKeys,
        preserveVisible: true,
      })
    }
  })
}

async function publishAndRelease(draftId: string, version: number) {
  const published = await publishBracketDraft({ draftId, expectedVersion: version })

  await prisma.bracketPageSetting.update({
    where: { id: 'default' },
    data: { publicEnabled: true },
  })
  await prisma.boutsPageSetting.update({
    where: { id: 'default' },
    data: { publicEnabled: true },
  })

  const activeDraws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: published.publishedGenerationId, status: 'ACTIVE' },
    include: { participants: true },
  })

  const experiencedDraws = activeDraws.filter((d) => d.categoryKey.includes(`:${EXPERIENCED}:`))

  const releaseResult = await setCategoriesBoutsReleased({
    scope: 'ready',
    released: true,
    expectedPublishedGenerationId: published.publishedGenerationId,
  })

  const visibilityResult = await setCategoriesPublicVisibility({
    scope: 'all',
    visible: true,
  })

  return { published, experiencedDraws, releaseResult, visibilityResult }
}

async function verifyPaidCoverage() {
  const eligible = await loadEligibleEntries({ includePaid: true, includeUnpaid: false })
  const experienced = eligible.filter((e) => e.experienceLevel === EXPERIENCED)

  const gen = await prisma.bracketGeneration.findFirst({
    where: { status: 'ACTIVE', singletonKey: 'live' },
  })
  if (!gen) {
    console.log('\n=== Проверка: live generation не найдена ===')
    return
  }

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: gen.id, status: 'ACTIVE' },
    include: { participants: true },
  })

  const drawEntryIds = new Set(draws.flatMap((d) => d.participants.map((p) => p.entryId)))
  const missing = experienced.filter((e) => !drawEntryIds.has(e.entryId))

  const pubStates = await prisma.bracketPublicationState.findMany({
    where: { categoryKey: { in: draws.map((d) => d.categoryKey) } },
  })
  const pubByKey = new Map(pubStates.map((s) => [s.categoryKey, s]))

  const notVisible = draws.filter((d) => d.participants.length >= 2 && !pubByKey.get(d.categoryKey)?.visible)
  const notReleased = draws.filter(
    (d) => d.participants.length >= 2 && !pubByKey.get(d.categoryKey)?.boutsReleased,
  )

  console.log(`\n=== Проверка покрытия ===`)
  console.log(`Оплаченных опытных заявок: ${experienced.length}`)
  console.log(`В сетках (live): ${experienced.length - missing.length}`)
  console.log(`Не в сетке: ${missing.length}`)
  if (missing.length > 0) {
    for (const e of missing.slice(0, 20)) {
      console.log(`  ! ${e.displayName} · ${getCategoryTitleFromKey(e.effectiveCategoryKey)} · ${e.discipline}`)
    }
  }
  console.log(`Сетки 2+ без публикации: ${notVisible.length}`)
  console.log(`Сетки 2+ без поединков: ${notReleased.length}`)
}

async function printSummary() {
  const gen = await prisma.bracketGeneration.findFirst({
    where: { status: 'ACTIVE', singletonKey: 'live' },
  })
  if (!gen) return

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: gen.id, status: 'ACTIVE', categoryKey: { contains: `:${EXPERIENCED}:` } },
    include: { participants: true },
    orderBy: { categoryKey: 'asc' },
  })

  const multi = draws.filter((d) => d.participants.length >= 2)
  const single = draws.filter((d) => d.participants.length === 1)

  console.log(`\n=== Итог: опытные категории ===`)
  console.log(`Сетки (2+): ${multi.length}, чемпионы (1): ${single.length}`)

  const entries = await loadEligibleEntries({ includePaid: true, includeUnpaid: false })

  for (const draw of multi) {
    console.log(`\n${getCategoryTitleFromKey(draw.categoryKey)} (${draw.participants.length})`)
    for (const p of draw.participants) {
      const e = entries.find((x) => x.entryId === p.entryId)
      console.log(`  • ${e?.displayName ?? p.entryId}`)
    }
  }

  console.log(`\nЧемпионы:`)
  for (const draw of single) {
    const p = draw.participants[0]
    const e = entries.find((x) => x.entryId === p?.entryId)
    console.log(`  ${getCategoryTitleFromKey(draw.categoryKey)} — ${e?.displayName ?? '?'}`)
  }
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== APPLY EXPERIENCED BRACKET GROUPS ===\n')

  if (!SKIP_PAYMENTS) {
    console.log('Шаг 1: оплата сестёр Гурьевых (ранняя регистрация)…')
    await markGurievaEarlyPayments()
  }

  const { moves, warnings } = await resolveMoves()
  const byCategory = new Map<string, string[]>()
  for (const m of moves) {
    if (!byCategory.has(m.title)) byCategory.set(m.title, [])
    byCategory.get(m.title)!.push(m.athleteName)
  }

  console.log(`\nШаг 2: групп (${GROUPS.length}), переносов: ${moves.length}\n`)
  for (const [title, names] of byCategory) {
    console.log(`${title} (${names.length})`)
    names.forEach((n) => console.log(`  • ${n}`))
  }

  if (warnings.length) {
    console.log(`\nПредупреждения (${warnings.length}):`)
    warnings.forEach((w) => console.log(`  ! ${w}`))
  }

  if (DRY_RUN) {
    await verifyPaidCoverage()
    console.log('\nDry run — изменения не применены.')
    return
  }

  console.log('\nШаг 3: переносы и пересборка…')
  let draft = await applyMoves(moves)

  console.log('\nШаг 4: пересборка одиночных категорий (чемпионы)…')
  await rebuildSingletons(draft.id)

  const finalGen = await prisma.bracketGeneration.findUnique({ where: { id: draft.id } })
  if (!finalGen) throw new Error('generation missing')

  console.log('\nШаг 5: жеребьёвка…')
  const redrawnFinal = await redrawBracketDraft({
    draftId: finalGen.id,
    expectedVersion: finalGen.version,
    scope: 'all',
  })
  draft = redrawnFinal.draft

  console.log('\nШаг 6: публикация и выпуск на площадку…')
  const { published, experiencedDraws, releaseResult, visibilityResult } = await publishAndRelease(
    draft.id,
    draft.version,
  )

  console.log(`\nОпубликовано: ${published.publishedGenerationId}`)
  console.log(`Опытных категорий: ${experiencedDraws.length}`)
  console.log(`Выпущено на площадку: ${releaseResult.affectedCategoryKeys?.length ?? 0}`)
  console.log(`Показано на сайте: ${visibilityResult.affectedCategoryKeys?.length ?? 0}`)

  await printSummary()
  await verifyPaidCoverage()
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
