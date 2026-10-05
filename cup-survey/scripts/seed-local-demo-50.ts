/**
 * Локальная демо-засыпка: 50 спортсменов в 6 категориях (3, 5, 7, 9, 11, 15 участников).
 *
 * Запуск: npm run seed:local-demo-50
 * После: npm run setup:local-public — опубликовать сетки на /brackets
 */
import { PrismaClient } from '@prisma/client'
import { incrementRegistrationRevision } from '../lib/brackets/core/locks'
import { ensureDraftExists } from '../lib/brackets/generation/ensureDraft'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { redrawBracketDraft } from '../lib/brackets/generation/redraw'
import { findOrCreateClub } from '../lib/registration/clubs'
import {
  getCategoryTitleFromKey,
  getRegistrationCategoryKey,
} from '../lib/registration/categoryIdentity'
import type { ExperienceLevelId } from '../lib/config/experienceLevel'

const prisma = new PrismaClient()

const SEED_TAG = 'local-demo-50'

type CategorySpec = {
  targetCount: number
  discipline: 'tactic_control'
  experienceLevel: ExperienceLevelId
  ageDivisionId: string
  weightCategoryId: string
  birthDate: string
  gender: 'male' | 'female'
}

/** 6 категорий × 50 спортсменов, размеры от 3 до 15. */
const CATEGORY_SPECS: CategorySpec[] = [
  {
    targetCount: 3,
    discipline: 'tactic_control',
    experienceLevel: 'novice',
    ageDivisionId: 'm_juniors_1',
    weightCategoryId: 'm_juniors_1_w_le_52',
    birthDate: '2010-02-15',
    gender: 'male',
  },
  {
    targetCount: 5,
    discipline: 'tactic_control',
    experienceLevel: 'novice',
    ageDivisionId: 'm_juniors_1',
    weightCategoryId: 'm_juniors_1_w_le_61',
    birthDate: '2010-04-15',
    gender: 'male',
  },
  {
    targetCount: 7,
    discipline: 'tactic_control',
    experienceLevel: 'novice',
    ageDivisionId: 'm_juniors_1',
    weightCategoryId: 'm_juniors_1_w_le_66',
    birthDate: '2010-05-15',
    gender: 'male',
  },
  {
    targetCount: 9,
    discipline: 'tactic_control',
    experienceLevel: 'novice',
    ageDivisionId: 'm_juniors_1',
    weightCategoryId: 'm_juniors_1_w_le_71',
    birthDate: '2010-06-15',
    gender: 'male',
  },
  {
    targetCount: 11,
    discipline: 'tactic_control',
    experienceLevel: 'novice',
    ageDivisionId: 'm_juniors_1',
    weightCategoryId: 'm_juniors_1_w_le_77',
    birthDate: '2010-07-15',
    gender: 'male',
  },
  {
    targetCount: 15,
    discipline: 'tactic_control',
    experienceLevel: 'novice',
    ageDivisionId: 'm_juniors_1',
    weightCategoryId: 'm_juniors_1_w_le_84',
    birthDate: '2010-08-15',
    gender: 'male',
  },
]

const firstNames = [
  'Артём',
  'Максим',
  'Дмитрий',
  'Кирилл',
  'Никита',
  'Егор',
  'Павел',
  'Роман',
  'Владимир',
  'Сергей',
  'Андрей',
  'Денис',
  'Илья',
  'Матвей',
  'Тимур',
  'Глеб',
]

const lastNames = [
  'Иванов',
  'Петров',
  'Смирнов',
  'Кузнецов',
  'Соколов',
  'Попов',
  'Лебедев',
  'Козлов',
  'Новиков',
  'Морозов',
  'Волков',
  'Соловьёв',
  'Васильев',
  'Зайцев',
  'Павлов',
  'Фёдоров',
]

const middleNames = [
  'Александрович',
  'Дмитриевич',
  'Сергеевич',
  'Андреевич',
  'Игоревич',
  'Михайлович',
  'Владимирович',
  'Николаевич',
]

const clubs = [
  { name: 'СК Тест-Демо', city: 'Первоуральск' },
  { name: 'СК Сетка-Локал', city: 'Екатеринбург' },
  { name: 'СК Брекет', city: 'Ревда' },
]

function parseWeight(weightCategoryId: string): number {
  if (weightCategoryId.includes('_w_le_')) {
    return Number(weightCategoryId.split('_w_le_')[1])
  }
  const min = Number(weightCategoryId.split('_w_gt_')[1])
  return min + 2
}

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]
}

function categoryKey(spec: CategorySpec): string {
  return getRegistrationCategoryKey({
    discipline: spec.discipline,
    experienceLevel: spec.experienceLevel,
    ageDivisionId: spec.ageDivisionId,
    weightCategoryId: spec.weightCategoryId,
  })
}

async function countPaidInCategory(spec: CategorySpec): Promise<number> {
  return prisma.athleteEntry.count({
    where: {
      discipline: spec.discipline,
      experienceLevel: spec.experienceLevel,
      ageDivisionId: spec.ageDivisionId,
      weightCategoryId: spec.weightCategoryId,
      paymentStatus: 'PAID',
    },
  })
}

async function main() {
  const price = 1500
  let totalAdded = 0
  const club = await findOrCreateClub(clubs[0].name, clubs[0].city)

  const totalTarget = CATEGORY_SPECS.reduce((sum, spec) => sum + spec.targetCount, 0)
  console.log(
    `\n${SEED_TAG}: категории ${CATEGORY_SPECS.map((s) => s.targetCount).join(', ')} (всего ${totalTarget} спортсменов)\n`,
  )

  for (const spec of CATEGORY_SPECS) {
    const key = categoryKey(spec)
    const title = getCategoryTitleFromKey(key)
    const current = await countPaidInCategory(spec)
    const toAdd = Math.max(0, spec.targetCount - current)

    if (toAdd === 0) {
      console.log(`  ✓ N=${spec.targetCount}: ${title} — уже ${current} участников`)
      continue
    }

    for (let i = 0; i < toAdd; i++) {
      const seed = spec.targetCount * 100 + current + i
      const clubPick = pick(clubs, seed)
      const registrationClub =
        clubPick.name === clubs[0].name
          ? club
          : await findOrCreateClub(clubPick.name, clubPick.city)

      await prisma.teamRegistration.create({
        data: {
          clubId: registrationClub.id,
          clubName: registrationClub.name,
          city: registrationClub.city,
          phone: `+7908${String(3_000_000 + seed).slice(-7)}`,
          email: `${SEED_TAG}-n${spec.targetCount}-${seed}@example.local`,
          registrationStage: 'main',
          pricePerDiscipline: price,
          totalAmount: price,
          status: 'PAID',
          consentPersonalData: true,
          consentPublication: true,
          athletes: {
            create: {
              lastName: pick(lastNames, seed),
              firstName: pick(firstNames, seed + 3),
              middleName: pick(middleNames, seed + 7),
              birthDate: new Date(spec.birthDate),
              gender: spec.gender,
              weight: parseWeight(spec.weightCategoryId),
              rank: 'kms',
              entries: {
                create: {
                  discipline: spec.discipline,
                  experienceLevel: spec.experienceLevel,
                  ageDivisionId: spec.ageDivisionId,
                  weightCategoryId: spec.weightCategoryId,
                  price,
                  paymentStatus: 'PAID',
                  paidAt: new Date(),
                },
              },
            },
          },
        },
      })
      totalAdded++
    }

    console.log(`  + N=${spec.targetCount}: ${title} — добавлено ${toAdd} (теперь ${current + toAdd})`)
  }

  if (totalAdded > 0) {
    await prisma.$transaction(async (tx) => {
      await incrementRegistrationRevision(tx)
    })

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
  }

  const athleteCount = await prisma.athlete.count()
  console.log(`\nИтого добавлено: ${totalAdded} спортсменов (в базе: ${athleteCount})`)
  if (totalAdded > 0) {
    console.log('Сетки синхронизированы и пережеребьёваны.')
  }
  console.log('\nДалее: npm run setup:local-public — опубликовать сетки на сайте.\n')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
