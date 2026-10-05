import { prisma } from '../lib/prisma'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'

const gen = await requireWorkingGeneration(prisma)
const entries = [
  '708f95a2-a1b7-498e-9f7f-6bb0b8128ba3', // mavlikayev close
  '7ea2a17a-f069-4853-a3d3-ce953ab0bfa4',
  'c20a6935-9187-442b-80d7-2f6a3751c9fd',
]

for (const entryId of entries) {
  const placement = await prisma.bracketEntryPlacement.findUnique({ where: { entryId } })
  const participant = await prisma.bracketDrawParticipant.findFirst({
    where: { entryId, draw: { generationId: gen.id } },
    include: { draw: { select: { categoryKey: true, title: true } } },
  })
  const entry = await prisma.athleteEntry.findUnique({
    where: { id: entryId },
    include: { athlete: { select: { lastName: true, firstName: true } } },
  })
  console.log({
    name: entry ? `${entry.athlete.lastName} ${entry.athlete.firstName}` : entryId,
    discipline: entry?.discipline,
    paymentStatus: entry?.paymentStatus,
    placement: placement?.categoryKey,
    draw: participant?.draw.categoryKey,
  })
}

const target = 'close_control:experienced:m_youths_3:m_youths_3_w_le_52'
const draw = await prisma.bracketCategoryDraw.findFirst({
  where: { generationId: gen.id, categoryKey: target },
  include: { participants: true, publicationState: true },
})
console.log('target draw:', draw?.participants.map((p) => p.entryId), 'visible:', draw?.publicationState?.visible)

await prisma.$disconnect()
