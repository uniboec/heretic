/**
 * Предложение v2: консолидация только соседних весов, без каскада.
 */
import { prisma } from '../lib/prisma'
import { formatAthleteFullName } from '../lib/registration/athleteName'
import { getAthleteAgeOnTournamentDate } from '../lib/registration/categoryRules'
import {
  getRegistrationCategoryKey,
  getCategoryTitleFromKey,
  type RegistrationCategoryIdentity,
} from '../lib/registration/categoryIdentity'
import { getAgeDivision } from '../lib/config/fseCategories'
import { applyConsolidationAction } from '../lib/brackets/consolidation/neighbors'
import type { EntryPaymentStatus } from '../lib/registration/status'

const INCLUDE_ADMITTED = process.argv.includes('--include-admitted')

type Slot = {
  entryId: string
  name: string
  gender: 'male' | 'female'
  age: number
  weight: number | null
  discipline: string
  wasNovice: boolean
  identity: RegistrationCategoryIdentity
  note: string
}

function short(n: string) {
  const p = n.split(/\s+/)
  return p.length >= 2 ? `${p[0]} ${p[1]}` : n
}

function expKey(i: RegistrationCategoryIdentity) {
  return getRegistrationCategoryKey({ ...i, experienceLevel: 'experienced' })
}

function title(i: RegistrationCategoryIdentity) {
  return getCategoryTitleFromKey(expKey(i))
}

async function loadSlots(): Promise<Slot[]> {
  const out: Slot[] = []
  const regs = await prisma.teamRegistration.findMany({
    where: { status: { not: 'CANCELLED' } },
    include: { athletes: { include: { entries: true } } },
  })
  for (const reg of regs) {
    for (const a of reg.athletes) {
      const gender = (a.gender?.toLowerCase() === 'female' ? 'female' : 'male') as 'male' | 'female'
      const age = getAthleteAgeOnTournamentDate(a.birthDate) ?? 0
      for (const e of a.entries) {
        const st = e.paymentStatus as EntryPaymentStatus
        const ok = st === 'PAID' || (INCLUDE_ADMITTED && (st === 'ADMITTED_WITHOUT_PAYMENT' || st === 'DEBT'))
        if (!ok || !e.ageDivisionId || !e.weightCategoryId) continue
        out.push({
          entryId: e.id,
          name: formatAthleteFullName(a),
          gender,
          age,
          weight: a.weight,
          discipline: e.discipline,
          wasNovice: e.experienceLevel === 'novice',
          identity: {
            discipline: e.discipline,
            experienceLevel: 'experienced',
            ageDivisionId: e.ageDivisionId,
            weightCategoryId: e.weightCategoryId,
          },
          note: '',
        })
      }
    }
  }
  return out
}

function consolidate(slots: Slot[]) {
  const buckets = new Map<string, Slot[]>()
  for (const s of slots) {
    const k = expKey(s.identity)
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k)!.push({ ...s })
  }

  const discipline = slots[0]?.discipline
  const gender = slots[0]?.gender

  // 1) Внутри возраста: одиночки поднимаем на 1 вес вверх, пока не найдут пару или не упрёмся
  const ageIds = [...new Set(slots.map((s) => s.identity.ageDivisionId))]
  for (const ageId of ageIds) {
    let guard = 0
    while (guard++ < 20) {
      let moved = false
      const div = getAgeDivision(ageId)
      if (!div) break
      for (let wi = 0; wi < div.weightCategories.length; wi++) {
        const w = div.weightCategories[wi]
        const id: RegistrationCategoryIdentity = {
          discipline,
          experienceLevel: 'experienced',
          ageDivisionId: ageId,
          weightCategoryId: w.id,
        }
        const key = expKey(id)
        const bucket = buckets.get(key)
        if (!bucket || bucket.length !== 1) continue
        if (wi >= div.weightCategories.length - 1) continue
        const up = applyConsolidationAction(id, { type: 'WEIGHT_UP' })
        if (!up) continue
        const upKey = expKey(up)
        buckets.delete(key)
        const target = buckets.get(upKey) ?? []
        for (const a of bucket) {
          a.note += ` → ${getCategoryTitleFromKey(upKey)}`
          target.push(a)
        }
        buckets.set(upKey, target)
        moved = true
      }
      if (!moved) break
    }
  }

  // 2) Одиночки: возраст вверх на 1 шаг (если ≤17), снова ищем соседа
  let guard2 = 0
  while (guard2++ < 30) {
    let moved = false
    for (const [key, bucket] of [...buckets.entries()]) {
      if (bucket.length !== 1) continue
      const id = parseKey(key)
      if (!id || bucket[0].age > 17) continue
      const up = applyConsolidationAction(id, { type: 'AGE_UP', weightMapping: 'NEAREST_KG' })
      if (!up) continue
      const upKey = expKey(up)
      buckets.delete(key)
      const target = buckets.get(upKey) ?? []
      for (const a of bucket) {
        a.note += ` → ${getCategoryTitleFromKey(upKey)}`
        target.push(a)
      }
      buckets.set(upKey, target)
      moved = true
      break
    }
    if (!moved) break
  }

  // 3) Слияние 1+1 соседних весов в старший
  for (const ageId of ageIds) {
    const div = getAgeDivision(ageId)
    if (!div) continue
    for (let wi = 0; wi < div.weightCategories.length - 1; wi++) {
      const light = div.weightCategories[wi].id
      const heavy = div.weightCategories[wi + 1].id
      const lightKey = expKey({
        discipline,
        experienceLevel: 'experienced',
        ageDivisionId: ageId,
        weightCategoryId: light,
      })
      const heavyKey = expKey({
        discipline,
        experienceLevel: 'experienced',
        ageDivisionId: ageId,
        weightCategoryId: heavy,
      })
      const lb = buckets.get(lightKey)
      const hb = buckets.get(heavyKey)
      if (lb?.length === 1 && hb?.length === 1) {
        for (const a of lb) a.note += ` → ${getCategoryTitleFromKey(heavyKey)}`
        buckets.set(heavyKey, [...hb, ...lb])
        buckets.delete(lightKey)
      }
    }
  }

  return buckets
}

function parseKey(key: string): RegistrationCategoryIdentity | null {
  const p = key.split(':')
  if (p.length !== 4) return null
  return { discipline: p[0], experienceLevel: p[1], ageDivisionId: p[2], weightCategoryId: p[3] }
}

async function main() {
  const all = await loadSlots()
  console.log(`Заявок: ${all.length} | новичков: ${all.filter((s) => s.wasNovice).length}`)
  console.log('Принцип: все → Опытные; внутри возраста вес ↑; затем возраст ↑; чемпионы если нет пары\n')

  const byDG = new Map<string, Slot[]>()
  for (const s of all) {
    const k = `${s.discipline}:${s.gender}`
    if (!byDG.has(k)) byDG.set(k, [])
    byDG.get(k)!.push(s)
  }

  let brackets = 0
  let champions = 0
  let athletesInBrackets = 0

  for (const [dg, group] of [...byDG.entries()].sort()) {
    const [disc, g] = dg.split(':')
    const label = disc === 'tactic_control' ? 'ТАКТИК' : 'КЛОУС'
    console.log(`\n## ${label} · ${g === 'male' ? 'мальчики/мужчины' : 'девочки/девушки'}`)
    const buckets = consolidate(group)
    for (const key of [...buckets.keys()].sort((a, b) => a.localeCompare(b, 'ru'))) {
      const b = buckets.get(key)!
      const t = getCategoryTitleFromKey(key)
      if (b.length >= 2) {
        brackets++
        athletesInBrackets += b.length
        console.log(`\n**Сетка (${b.length})** ${t}`)
        for (const a of b) {
          const src = title({ ...a.identity, experienceLevel: a.wasNovice ? 'novice' : 'experienced' })
          const nov = a.wasNovice ? ' [был новичок]' : ''
          console.log(`- ${short(a.name)}, ${a.age} лет, ${a.weight ?? '?'} кг${nov} (заявка: ${src})`)
        }
      } else {
        champions++
        const a = b[0]
        const nov = a.wasNovice ? ' [был новичок]' : ''
        console.log(`\n**Чемпион** ${t}`)
        console.log(`- ${short(a.name)}, ${a.age} лет, ${a.weight ?? '?'} кг${nov}`)
      }
    }
  }

  console.log(`\n---\nСеток: ${brackets} (${athletesInBrackets} чел.) | Чемпионов: ${champions}`)
}

main().finally(() => prisma.$disconnect())
