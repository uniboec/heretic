/**
 * Предложение по формированию сеток: оплаченные заявки → опытные,
 * объединение сначала по весу вверх, затем по возрасту вверх.
 *
 * Запуск: npx tsx scripts/propose-category-consolidation.ts [--include-admitted]
 */
import { prisma } from '../lib/prisma'
import { formatAthleteFullName } from '../lib/registration/athleteName'
import {
  getAthleteAgeOnTournamentDate,
  getEligibleAgeDivisions,
  canRegisterInHigherAgeDivision,
} from '../lib/registration/categoryRules'
import {
  getRegistrationCategoryKey,
  getCategoryTitleFromKey,
  type RegistrationCategoryIdentity,
} from '../lib/registration/categoryIdentity'
import { getAgeDivision } from '../lib/config/fseCategories'
import { applyConsolidationAction } from '../lib/brackets/consolidation/neighbors'
import { getExperienceLevelLabel } from '../lib/config/experienceLevel'
import type { EntryPaymentStatus } from '../lib/registration/status'

const INCLUDE_ADMITTED = process.argv.includes('--include-admitted')

type AthleteSlot = {
  entryId: string
  name: string
  gender: 'male' | 'female'
  age: number
  declaredWeight: number | null
  discipline: string
  originalExperience: string
  paymentStatus: EntryPaymentStatus
  sourceIdentity: RegistrationCategoryIdentity
  moves: string[]
}

function bucketKey(identity: RegistrationCategoryIdentity) {
  return getRegistrationCategoryKey({ ...identity, experienceLevel: 'experienced' })
}

function shortName(name: string) {
  const p = name.split(/\s+/)
  return p.length >= 2 ? `${p[0]} ${p[1]}` : name
}

function isPaidStatus(status: EntryPaymentStatus) {
  if (status === 'PAID') return true
  if (INCLUDE_ADMITTED) {
    return status === 'ADMITTED_WITHOUT_PAYMENT' || status === 'DEBT'
  }
  return false
}

function canAgeUp(age: number) {
  return canRegisterInHigherAgeDivision(age)
}

async function loadPaidSlots(): Promise<AthleteSlot[]> {
  const registrations = await prisma.teamRegistration.findMany({
    where: { status: { not: 'CANCELLED' } },
    include: { athletes: { include: { entries: true } } },
  })

  const slots: AthleteSlot[] = []

  for (const reg of registrations) {
    for (const athlete of reg.athletes) {
      const gender = (athlete.gender?.toLowerCase() === 'female' ? 'female' : 'male') as
        | 'male'
        | 'female'
      const age = getAthleteAgeOnTournamentDate(athlete.birthDate) ?? 0
      const name = formatAthleteFullName(athlete)

      for (const entry of athlete.entries) {
        if (!isPaidStatus(entry.paymentStatus as EntryPaymentStatus)) continue
        if (!entry.ageDivisionId || !entry.weightCategoryId) continue

        const sourceIdentity: RegistrationCategoryIdentity = {
          discipline: entry.discipline,
          experienceLevel: entry.experienceLevel,
          ageDivisionId: entry.ageDivisionId,
          weightCategoryId: entry.weightCategoryId,
        }

        slots.push({
          entryId: entry.id,
          name,
          gender,
          age,
          declaredWeight: athlete.weight,
          discipline: entry.discipline,
          originalExperience: entry.experienceLevel,
          paymentStatus: entry.paymentStatus as EntryPaymentStatus,
          sourceIdentity,
          moves: [],
        })
      }
    }
  }

  return slots
}

function groupByDisciplineGender(slots: AthleteSlot[]) {
  const map = new Map<string, AthleteSlot[]>()
  for (const slot of slots) {
    const key = `${slot.discipline}:${slot.gender}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(slot)
  }
  return map
}

function consolidateGroup(slots: AthleteSlot[]) {
  const buckets = new Map<string, AthleteSlot[]>()

  for (const slot of slots) {
    const key = bucketKey(slot.sourceIdentity)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push({ ...slot, moves: [...slot.moves] })
  }

  // Фаза 1: внутри возрастной группы поднимаем лёгкие веса вверх
  const ageDivisions = [...new Set(slots.map((s) => s.sourceIdentity.ageDivisionId))]
  for (const ageDivisionId of ageDivisions) {
    const division = getAgeDivision(ageDivisionId)
    if (!division) continue

    for (let wi = 0; wi < division.weightCategories.length - 1; wi++) {
      const lightId = division.weightCategories[wi].id
      const heavyId = division.weightCategories[wi + 1].id
      const sample = slots[0]
      const lightKey = getRegistrationCategoryKey({
        discipline: sample.discipline,
        experienceLevel: 'experienced',
        ageDivisionId,
        weightCategoryId: lightId,
      })
      const heavyKey = getRegistrationCategoryKey({
        discipline: sample.discipline,
        experienceLevel: 'experienced',
        ageDivisionId,
        weightCategoryId: heavyId,
      })

      const lightBucket = buckets.get(lightKey)
      if (!lightBucket || lightBucket.length === 0) continue

      if (!buckets.has(heavyKey)) buckets.set(heavyKey, [])
      const heavyBucket = buckets.get(heavyKey)!
      const titleFrom = getCategoryTitleFromKey(lightKey)
      const titleTo = getCategoryTitleFromKey(heavyKey)

      for (const athlete of lightBucket) {
        athlete.moves.push(`вес ↑: ${titleFrom} → ${titleTo}`)
        heavyBucket.push(athlete)
      }
      buckets.delete(lightKey)
    }
  }

  // Фаза 2: одиночки — подъём по весу пошагово, затем по возрасту
  let changed = true
  while (changed) {
    changed = false
    for (const [key, bucket] of [...buckets.entries()]) {
      if (bucket.length !== 1) continue
      const athlete = bucket[0]
      const identity = parseKey(key)
      if (!identity) continue

      const weightUp = applyConsolidationAction(
        { ...identity, experienceLevel: 'experienced' },
        { type: 'WEIGHT_UP' },
      )
      if (weightUp) {
        const nextKey = bucketKey(weightUp)
        const existing = buckets.get(nextKey) ?? []
        if (existing.length >= 1) {
          buckets.delete(key)
          athlete.moves.push(`вес ↑: ${getCategoryTitleFromKey(key)} → ${getCategoryTitleFromKey(nextKey)}`)
          if (!buckets.has(nextKey)) buckets.set(nextKey, [])
          buckets.get(nextKey)!.push(athlete)
          changed = true
          continue
        }
      }

      if (canAgeUp(athlete.age)) {
        const ageUp = applyConsolidationAction(
          { ...identity, experienceLevel: 'experienced' },
          { type: 'AGE_UP', weightMapping: 'NEAREST_KG' },
        )
        if (ageUp) {
          const nextKey = bucketKey(ageUp)
          buckets.delete(key)
          athlete.moves.push(`возраст ↑: ${getCategoryTitleFromKey(key)} → ${getCategoryTitleFromKey(nextKey)}`)
          if (!buckets.has(nextKey)) buckets.set(nextKey, [])
          buckets.get(nextKey)!.push(athlete)
          changed = true
        }
      }
    }
  }

  // Фаза 3: сливаем соседние мелкие группы (2+2 в одну) — только если обе <3 и тот же возраст
  for (const ageDivisionId of ageDivisions) {
    const division = getAgeDivision(ageDivisionId)
    if (!division) continue
    for (let wi = 0; wi < division.weightCategories.length - 1; wi++) {
      const aId = division.weightCategories[wi].id
      const bId = division.weightCategories[wi + 1].id
      const sample = slots[0]
      const keyA = getRegistrationCategoryKey({
        discipline: sample.discipline,
        experienceLevel: 'experienced',
        ageDivisionId,
        weightCategoryId: aId,
      })
      const keyB = getRegistrationCategoryKey({
        discipline: sample.discipline,
        experienceLevel: 'experienced',
        ageDivisionId,
        weightCategoryId: bId,
      })
      const bucketA = buckets.get(keyA)
      const bucketB = buckets.get(keyB)
      if (!bucketA || !bucketB) continue
      if (bucketA.length === 1 && bucketB.length === 1) {
        const titleTo = getCategoryTitleFromKey(keyB)
        for (const athlete of bucketA) {
          athlete.moves.push(`слияние 1+1 → ${titleTo}`)
          bucketB.push(athlete)
        }
        buckets.delete(keyA)
      }
    }
  }

  return buckets
}

function parseKey(key: string): RegistrationCategoryIdentity | null {
  const parts = key.split(':')
  if (parts.length !== 4) return null
  return {
    discipline: parts[0],
    experienceLevel: parts[1],
    ageDivisionId: parts[2],
    weightCategoryId: parts[3],
  }
}

function disciplineLabel(d: string) {
  return d === 'tactic_control' ? 'Тактик Контрол' : 'Клоус Контрол'
}

async function main() {
  const slots = await loadPaidSlots()
  const noviceCount = slots.filter((s) => s.originalExperience === 'novice').length
  const paidOnly = slots.filter((s) => s.paymentStatus === 'PAID').length

  console.log('=== ИСХОДНЫЕ ДАННЫЕ ===')
  console.log(
    `Заявок в анализе: ${slots.length} (${INCLUDE_ADMITTED ? 'PAID + допущены + долг' : 'только PAID'})`,
  )
  console.log(`Из них строго PAID: ${paidOnly}`)
  console.log(`Новичков (→ опытные): ${noviceCount}`)
  console.log()

  const warnings: string[] = []
  const byAthleteDisc = new Map<string, AthleteSlot[]>()
  for (const s of slots) {
    const k = `${s.name}:${s.discipline}`
    if (!byAthleteDisc.has(k)) byAthleteDisc.set(k, [])
    byAthleteDisc.get(k)!.push(s)
  }
  for (const [k, list] of byAthleteDisc) {
    if (list.length > 1) {
      warnings.push(
        `${shortName(k.split(':')[0])} — ${list.length} заявки в ${disciplineLabel(list[0].discipline)}: ${list.map((x) => getCategoryTitleFromKey(bucketKey(x.sourceIdentity))).join('; ')}`,
      )
    }
  }

  if (warnings.length) {
    console.log('⚠ Дубли / несколько заявок в одной дисциплине:')
    warnings.forEach((w) => console.log(`  • ${w}`))
    console.log()
  }

  const groups = groupByDisciplineGender(slots)
  const allProposals: Array<{
    title: string
    athletes: AthleteSlot[]
    type: 'bracket' | 'champion'
  }> = []

  for (const [dgKey, groupSlots] of [...groups.entries()].sort()) {
    const [discipline, gender] = dgKey.split(':')
    const buckets = consolidateGroup(groupSlots)

    console.log(`\n${'='.repeat(60)}`)
    console.log(`${disciplineLabel(discipline)} · ${gender === 'male' ? 'мужчины/мальчики' : 'девочки/девушки'}`)
    console.log('='.repeat(60))

    const sortedKeys = [...buckets.keys()].sort((a, b) => a.localeCompare(b, 'ru'))

    for (const key of sortedKeys) {
      const bucket = buckets.get(key)!
      const title = getCategoryTitleFromKey(key)
      const type = bucket.length >= 2 ? 'bracket' : 'champion'
      allProposals.push({ title, athletes: bucket, type })

      const icon = type === 'bracket' ? `[сетка ${bucket.length}]` : '[чемпион]'
      console.log(`\n${icon} ${title}`)
      for (const a of bucket) {
        const from = getCategoryTitleFromKey(bucketKey(a.sourceIdentity))
        const exp =
          a.originalExperience === 'novice'
            ? ` (был ${getExperienceLevelLabel('novice')})`
            : ''
        const move = a.moves.length ? ` ← ${a.moves.join('; ')}` : ''
        console.log(`  • ${shortName(a.name)}, ${a.age} лет, ${a.declaredWeight ?? '?'} кг${exp}`)
        if (from !== title) console.log(`      заявка: ${from}${move}`)
        else if (exp) console.log(`      заявка: ${from}${exp}`)
      }
    }
  }

  const brackets = allProposals.filter((p) => p.type === 'bracket')
  const champions = allProposals.filter((p) => p.type === 'champion')
  const bracketAthletes = brackets.reduce((s, p) => s + p.athletes.length, 0)
  const championAthletes = champions.reduce((s, p) => s + p.athletes.length, 0)

  console.log(`\n${'='.repeat(60)}`)
  console.log('=== СВОДКА ===')
  console.log(`Сеток (2+): ${brackets.length} (${bracketAthletes} спортсменов)`)
  console.log(`Чемпионов (1): ${champions.length} (${championAthletes} спортсменов)`)
  console.log(`Всего: ${slots.length} заявок`)
  console.log(`Ориентировочно поединков (без учёта системы): ~${estimateBouts(brackets)}`)
}

function estimateBouts(brackets: Array<{ athletes: AthleteSlot[] }>) {
  let total = 0
  for (const b of brackets) {
    const n = b.athletes.length
    if (n === 2) total += 1
    else if (n === 3) total += 3
    else if (n === 4) total += 4
    else if (n >= 5) total += n - 1 // олимпийка грубо
  }
  return total
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
