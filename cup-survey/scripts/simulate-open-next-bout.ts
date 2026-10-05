import { prisma } from '../lib/prisma'
import { getMatControlSnapshot, executeMatControlCommand } from '../lib/bouts/matControlService'

const boutId = 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_52::bout-1'
const matIndex = 1

async function main() {
  const before = await getMatControlSnapshot(matIndex)
  const session = await prisma.matControlSession.findUnique({
    where: { tournamentScopeId_matIndex: { tournamentScopeId: 'cup-2026', matIndex } },
  })
  if (!session?.holderToken) {
    throw new Error('No mat session holder token')
  }

  await executeMatControlCommand({
    boutId,
    intent: 'OPEN_NEXT_BOUT',
    payload: {},
    envelope: {
      operationId: `sim-open-next-${Date.now()}`,
      holderToken: session.holderToken,
      expectedLiveRevision: before.activeBout?.execution.liveRevision ?? 0,
      expectedAttemptNumber: before.activeBout?.execution.attemptNumber ?? 1,
    },
  })

  const after = await getMatControlSnapshot(matIndex)
  console.log(
    JSON.stringify(
      {
        before: {
          activeBoutId: before.activeBout?.boutId,
          phase: before.activeBout?.execution.boutPhase,
          nextAvailable: before.queue.nextAvailable?.bout.id,
        },
        after: {
          activeBoutId: after.activeBout?.boutId,
          phase: after.activeBout?.execution.boutPhase,
          nextAvailable: after.queue.nextAvailable?.bout.id,
        },
      },
      null,
      2,
    ),
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
