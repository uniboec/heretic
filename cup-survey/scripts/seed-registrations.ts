import { PrismaClient, RegistrationStatus } from '@prisma/client'
import { findOrCreateClub } from '../lib/registration/clubs'
import { grantDeviceAccess, hashEditCode } from '../lib/registration/editAccess'
import { getEligibleAgeDivisions } from '../lib/registration/categoryRules'

const prisma = new PrismaClient()

const clubNames = [
  'СК Универсальные бойцы',
  'СК Ратиборец',
  'СК Сила',
  'СК Горизонт',
  'СК Беркут',
  'СК Титан',
  'СК Атлет',
  'СК Восток',
  'СК Зенит',
  'СК Фортуна',
]

const firstNames = ['Иван', 'Максим', 'Артём', 'Дмитрий', 'Кирилл', 'Александр', 'Михаил', 'Никита', 'Егор', 'Павел']
const lastNames = ['Иванов', 'Петров', 'Смирнов', 'Кузнецов', 'Попов', 'Соколов', 'Лебедев', 'Козлов', 'Новиков', 'Морозов']

function pickCategory(
  birthDate: Date,
  gender: 'male' | 'female',
  weightIndex: number,
): { ageDivisionId: string; weightCategoryId: string } {
  const birthIso = birthDate.toISOString().slice(0, 10)
  const divisions = getEligibleAgeDivisions(birthIso, gender)
  const division = divisions[0]
  if (!division) {
    throw new Error(`No eligible division for ${birthIso} ${gender}`)
  }
  const weight = division.weightCategories[weightIndex % division.weightCategories.length]
  return { ageDivisionId: division.id, weightCategoryId: weight.id }
}

async function main() {
  const existing = await prisma.teamRegistration.count()
  if (existing >= 10) {
    console.log(`Already have ${existing} registrations, skipping seed`)
    return
  }

  const statuses: RegistrationStatus[] = [
    'PAID',
    'PAID',
    'PAYMENT_REVIEW',
    'AWAITING_PAYMENT',
    'PAID',
    'PAID',
    'AWAITING_PAYMENT',
    'PAID',
    'PAYMENT_REVIEW',
    'PAID',
  ]

  for (let i = 0; i < 10; i++) {
    const clubName = clubNames[i]
    const city = i % 2 === 0 ? 'Первоуральск' : 'Екатеринбург'
    const club = await findOrCreateClub(clubName, city)
    const athletesCount = 1 + (i % 3)
    const price = 1500
    let total = 0
    const athletesData = []

    for (let a = 0; a < athletesCount; a++) {
      const disciplines =
        a % 2 === 0 ? ['tactic_control', 'close_control'] : ['tactic_control']
      total += disciplines.length * price

      const birthDate = new Date(`201${a + 2}-0${(a % 9) + 1}-15`)
      const gender = a % 3 === 0 ? 'female' : 'male'
      const category = pickCategory(birthDate, gender, i + a)

      athletesData.push({
        lastName: lastNames[(i + a) % lastNames.length],
        firstName: firstNames[(i + a) % firstNames.length],
        middleName: a % 2 === 0 ? 'Сергеевич' : null,
        birthDate,
        gender,
        weight: category.weightCategoryId.includes('_w_le_')
          ? Number(category.weightCategoryId.split('_w_le_')[1])
          : Number(category.weightCategoryId.split('_w_gt_')[1]),
        rank: ['none', 'child_2', 'youth_1', 'adult_3', 'kms'][i % 5],
        entries: {
          create: disciplines.map((discipline) => {
            const athleteRank = ['none', 'child_2', 'youth_1', 'adult_3', 'kms'][i % 5]
            const experienced = !['none', 'child_3', 'youth_3', 'adult_3'].includes(athleteRank)
            const paymentStatus = (
              statuses[i] === 'PAID'
                ? 'PAID'
                : statuses[i] === 'PAYMENT_REVIEW'
                  ? 'PAYMENT_REVIEW'
                  : 'UNPAID'
            ) as 'PAID' | 'PAYMENT_REVIEW' | 'UNPAID'
            return {
              discipline,
              experienceLevel: experienced ? 'experienced' : 'novice',
              ageDivisionId: category.ageDivisionId,
              weightCategoryId: category.weightCategoryId,
              price,
              paymentStatus,
            }
          }),
        },
      })
    }

    const created = await prisma.teamRegistration.create({
      data: {
        clubId: club.id,
        clubName: club.name,
        city: club.city,
        phone: `+7900${String(1000000 + i).slice(-7)}`,
        email: `club${i + 1}@example.com`,
        registrationStage: 'early',
        pricePerDiscipline: price,
        totalAmount: total,
        status: statuses[i],
        consentPersonalData: true,
        consentPublication: true,
        editCodeHash: await hashEditCode('demo1234'),
        athletes: { create: athletesData },
      },
    })

    await grantDeviceAccess(created.id, '00000000-0000-4000-8000-000000000001')
  }

  console.log('Seeded 10 test registrations')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
