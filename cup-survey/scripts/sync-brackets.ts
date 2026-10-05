/**
 * Синхронизирует черновик сеток с заявками и выполняет пережеребьёвку.
 * Запуск: npm run brackets:sync
 */
import { prisma } from '../lib/prisma'
import { ensureDraftExists } from '../lib/brackets/generation/ensureDraft'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { redrawBracketDraft } from '../lib/brackets/generation/redraw'
import { loadEligibleEntries } from '../lib/brackets/core/eligibility'

const DEFAULT_FORMAT_RULES = [
  {
    minParticipants: 2,
    maxParticipants: 2,
    systemId: 'olympic',
    allowedSystemIds: ['olympic'],
    sortOrder: 0,
    enabled: true,
  },
  {
    minParticipants: 3,
    maxParticipants: 3,
    systemId: 'three_way',
    allowedSystemIds: ['three_way', 'round_robin'],
    sortOrder: 1,
    enabled: true,
  },
  {
    minParticipants: 4,
    maxParticipants: 5,
    systemId: 'olympic',
    defaultBronzeMode: 'ONE' as const,
    allowedSystemIds: ['olympic', 'round_robin'],
    sortOrder: 2,
    enabled: true,
  },
  {
    minParticipants: 6,
    maxParticipants: 32,
    systemId: 'olympic',
    defaultBronzeMode: 'ONE' as const,
    allowedSystemIds: ['olympic'],
    sortOrder: 3,
    enabled: true,
  },
]

async function ensureBracketDefaults() {
  await prisma.tournamentRegistrationState.upsert({
    where: { id: 'default' },
    create: { revision: BigInt(0) },
    update: {},
  })
  await prisma.bracketPageSetting.upsert({
    where: { id: 'default' },
    create: { publicEnabled: false, includePaid: true, includeUnpaid: false },
    update: {},
  })
  const ruleCount = await prisma.bracketFormatRule.count()
  if (ruleCount === 0) {
    await prisma.bracketFormatRule.createMany({ data: DEFAULT_FORMAT_RULES })
  }
}

async function main() {
  await ensureBracketDefaults()

  const settings = await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })
  const eligible = await loadEligibleEntries({
    includePaid: settings?.includePaid ?? true,
    includeUnpaid: settings?.includeUnpaid ?? false,
  })

  if (eligible.length === 0) {
    console.error(
      'Нет допущенных участников для сеток. Сначала выполните npm run seed:bracket-sizes или seed:athletes.',
    )
    process.exit(1)
  }

  const draft = await ensureDraftExists()
  console.log(`Черновик ${draft.id}, версия ${draft.version}, допущено участников: ${eligible.length}`)

  const synced = await syncBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
  })

  const redrawn = await redrawBracketDraft({
    draftId: synced.draft.id,
    expectedVersion: synced.draft.version,
    scope: 'all',
  })

  const categories = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: redrawn.draft.id },
    include: { participants: true },
  })
  const withParticipants = categories.filter((c) => c.participants.length > 0)

  console.log(
    `Готово: версия ${redrawn.draft.version}, категорий с участниками: ${withParticipants.length}, всего участников в сетках: ${withParticipants.reduce((s, c) => s + c.participants.length, 0)}`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
