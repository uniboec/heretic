#!/usr/bin/env npx tsx
/**
 * Seeds stress-matrix categories (1–32 athletes) into the local/dev database.
 * Each size gets its own weight category and multiple clubs.
 *
 * npx tsx scripts/seed-stress-matrix.ts
 * npx tsx scripts/seed-stress-matrix.ts --sizes 1,2,3,16,32
 */
import { PrismaClient } from '@prisma/client'
import { incrementRegistrationRevision } from '../lib/brackets/core/locks'
import { ensureDraftExists } from '../lib/brackets/generation/ensureDraft'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { redrawBracketDraft } from '../lib/brackets/generation/redraw'
import {
  getRegistrationCategoryKey,
  getCategoryTitleFromKey,
} from '../lib/registration/categoryIdentity'

const prisma = new PrismaClient()

const DEFAULT_SIZES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32]
const CLUBS = [
  { name: 'Stress Alpha', city: 'Первоуральск' },
  { name: 'Stress Beta', city: 'Екатеринбург' },
  { name: 'Stress Gamma', city: 'Ревда' },
  { name: 'Stress Delta', city: 'Каменск' },
  { name: 'Stress Epsilon', city: 'Асбест' },
  { name: 'Stress Zeta', city: 'Полевской' },
  { name: 'Stress Eta', city: 'Нижний Тагил' },
  { name: 'Stress Theta', city: 'Серов' },
]

function parseSizesArg(): number[] {
  const arg = process.argv.find((item) => item.startsWith('--sizes='))
  if (!arg) return DEFAULT_SIZES
  return arg
    .slice('--sizes='.length)
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 32)
}

function stressWeightCategoryId(size: number): string {
  return `stress_matrix_w_${String(size).padStart(2, '0')}`
}

async function countPaid(size: number): Promise<number> {
  const weightCategoryId = stressWeightCategoryId(size)
  return prisma.athleteEntry.count({
    where: {
      discipline: 'tactic_control',
      experienceLevel: 'beginner',
      ageDivisionId: 'm_juniors_1',
      weightCategoryId,
      paymentStatus: 'PAID',
    },
  })
}

async function main() {
  const sizes = parseSizesArg()
  const price = 1500
  let totalAdded = 0

  console.log(`\nStress matrix seed: sizes ${sizes.join(', ')}\n`)

  for (const size of sizes) {
    const weightCategoryId = stressWeightCategoryId(size)
    const categoryKey = getRegistrationCategoryKey({
      discipline: 'tactic_control',
      experienceLevel: 'beginner',
      ageDivisionId: 'm_juniors_1',
      weightCategoryId,
    })
    const title = getCategoryTitleFromKey(categoryKey)
    const current = await countPaid(size)
    const toAdd = Math.max(0, size - current)
    const clubCount = size >= 16 ? 3 : Math.min(8, Math.max(2, Math.ceil(size / 4)))

    if (toAdd === 0) {
      console.log(`  ✓ N=${size}: ${title} — уже ${current}`)
      continue
    }

    for (let index = 0; index < toAdd; index++) {
      const club = CLUBS[index % clubCount]!
      const seed = size * 1000 + current + index
      await prisma.teamRegistration.create({
        data: {
          clubName: club.name,
          city: club.city,
          phone: `+7920${String(seed).padStart(7, '0')}`,
          email: `stress-matrix-n${size}-${seed}@example.local`,
          registrationStage: 'main',
          pricePerDiscipline: price,
          totalAmount: price,
          status: 'PAID',
          consentPersonalData: true,
          consentPublication: true,
          athletes: {
            create: {
              lastName: `Matrix${size}`,
              firstName: `Athlete${index + 1}`,
              birthDate: new Date(`2012-${String((index % 12) + 1).padStart(2, '0')}-10`),
              gender: 'male',
              entries: {
                create: {
                  discipline: 'tactic_control',
                  experienceLevel: 'beginner',
                  ageDivisionId: 'm_juniors_1',
                  weightCategoryId,
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

    console.log(`  + N=${size}: ${title} — добавлено ${toAdd} (теперь ${current + toAdd}, клубов ${clubCount})`)
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
    console.log(`\nДобавлено ${totalAdded} спортсmenов, сетки sync+redraw выполнены.\n`)
  } else {
    console.log('\nНовых спортсmenов не добавлено.\n')
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
