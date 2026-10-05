import { PrismaClient } from '@prisma/client'
import { bumpRegistrationRevision } from '../lib/registration/revision'
import { ensureDraftExists } from '../lib/brackets/generation/ensureDraft'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { redrawBracketDraft } from '../lib/brackets/generation/redraw'
import { findOrCreateClub } from '../lib/registration/clubs'
import { getEligibleAgeDivisions } from '../lib/registration/categoryRules'

const prisma = new PrismaClient()

const COUNT = Number(process.argv[2] ?? process.env.SEED_ATHLETES_COUNT ?? 50)

const clubNames = [
  'СК Универсальные бойцы',
  'СК Ратиборец',
  'СК Сила',
  'СК Горизонт',
  'СК Беркут',
  'СК Титан',
  'СК Атлет',
  'СК Зенит',
  'СК Фортуна',
  'СК Восток',
  'СК Урал',
  'СК Спарта',
  'СК Легион',
  'СК Феникс',
  'СК Гром',
]

const cities = ['Первоуральск', 'Екатеринбург', 'Ревда', 'Асбест', 'Каменск-Уральский']

const firstNamesMale = [
  'Иван',
  'Максим',
  'Артём',
  'Дмитрий',
  'Кирилл',
  'Александр',
  'Михаил',
  'Никита',
  'Егор',
  'Павел',
  'Роман',
  'Владимир',
  'Сергей',
  'Андрей',
  'Денис',
]

const firstNamesFemale = [
  'Анна',
  'Мария',
  'Елена',
  'Ольга',
  'Дарья',
  'Алина',
  'Виктория',
  'Полина',
  'София',
  'Ксения',
]

const lastNames = [
  'Иванов',
  'Петров',
  'Смирнов',
  'Кузнецов',
  'Попов',
  'Соколов',
  'Лебедев',
  'Козлов',
  'Новиков',
  'Морозов',
  'Волков',
  'Соловьёв',
  'Васильев',
  'Зайцев',
  'Павлов',
]

const middleNamesMale = ['Сергеевич', 'Александрович', 'Дмитриевич', 'Андреевич', 'Игоревич']
const middleNamesFemale = ['Сергеевна', 'Александровна', 'Дмитриевна', 'Андреевна', 'Игоревна']

const ranks = ['none', 'child_2', 'youth_1', 'adult_3', 'kms', 'ms'] as const

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]
}

function randomBirthDate(seed: number): Date {
  const year = 2008 + (seed % 10)
  const month = 1 + (seed % 12)
  const day = 1 + (seed % 28)
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
}

function pickCategory(birthDate: Date, gender: 'male' | 'female', seed: number) {
  const birthIso = birthDate.toISOString().slice(0, 10)
  const divisions = getEligibleAgeDivisions(birthIso, gender)
  const division = divisions[seed % divisions.length] ?? divisions[0]
  if (!division) {
    throw new Error(`Нет подходящей категории для ${birthIso} (${gender})`)
  }
  const weight = division.weightCategories[seed % division.weightCategories.length]
  return { ageDivisionId: division.id, weightCategoryId: weight.id }
}

function parseWeight(weightCategoryId: string): number {
  if (weightCategoryId.includes('_w_le_')) {
    return Number(weightCategoryId.split('_w_le_')[1])
  }
  return Number(weightCategoryId.split('_w_gt_')[1])
}

async function main() {
  if (!Number.isFinite(COUNT) || COUNT < 1) {
    throw new Error('Укажите положительное число спортсменов: npm run seed:athletes -- 50')
  }

  const before = await prisma.athlete.count()
  const price = 1500

  for (let i = 0; i < COUNT; i++) {
    const seed = before + i
    const gender: 'male' | 'female' = seed % 5 === 0 ? 'female' : 'male'
    const birthDate = randomBirthDate(seed)
    const category = pickCategory(birthDate, gender, seed)
    const clubName = pick(clubNames, seed)
    const city = pick(cities, seed + 3)
    const club = await findOrCreateClub(clubName, city)
    const disciplines = seed % 7 === 0 ? ['tactic_control', 'close_control'] : ['tactic_control']
    const rank = pick(ranks, seed)
    const experienced = !['none', 'child_3', 'youth_3', 'adult_3'].includes(rank)
    const firstName = gender === 'female' ? pick(firstNamesFemale, seed) : pick(firstNamesMale, seed)
    const lastName = pick(lastNames, seed + 1)
    const middleName =
      gender === 'female' ? pick(middleNamesFemale, seed) : pick(middleNamesMale, seed)
    const total = disciplines.length * price

    await prisma.teamRegistration.create({
      data: {
        clubId: club.id,
        clubName: club.name,
        city: club.city,
        phone: `+7905${String(1_000_000 + seed).slice(-7)}`,
        email: `seed-athlete-${seed}@example.local`,
        registrationStage: seed % 3 === 0 ? 'early' : 'regular',
        pricePerDiscipline: price,
        totalAmount: total,
        status: 'PAID',
        consentPersonalData: true,
        consentPublication: true,
        athletes: {
          create: {
            lastName,
            firstName,
            middleName,
            birthDate,
            gender,
            weight: parseWeight(category.weightCategoryId),
            rank,
            entries: {
              create: disciplines.map((discipline) => ({
                discipline,
                experienceLevel: experienced ? 'experienced' : 'novice',
                ageDivisionId: category.ageDivisionId,
                weightCategoryId: category.weightCategoryId,
                price,
                paymentStatus: 'PAID',
                paidAt: new Date(),
              })),
            },
          },
        },
      },
    })
  }

  await bumpRegistrationRevision()

  const draft = await ensureDraftExists()
  const synced = await syncBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
  })
  await redrawBracketDraft({
    draftId: synced.draft.id,
    expectedVersion: synced.draft.version,
    scope: 'all',
  })

  const after = await prisma.athlete.count()
  console.log(`Добавлено ${COUNT} спортсменов (всего в базе: ${after}, было: ${before})`)
  console.log('Сетки синхронизированы и пережеребьёваны.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
