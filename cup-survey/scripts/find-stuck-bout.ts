import { prisma } from '../lib/prisma'
import { getMatControlSnapshot } from '../lib/bouts/matControlService'
import { loadFullScheduleSnapshot } from '../lib/bouts/scheduleService'

async function main() {
  const participants = await prisma.bracketDrawParticipant.findMany({
    where: {
      OR: [
        { snapshotDisplayName: { contains: 'Павлов', mode: 'insensitive' } },
        { snapshotDisplayName: { contains: 'Васильев', mode: 'insensitive' } },
      ],
    },
    include: {
      draw: { select: { categoryKey: true } },
    },
  })

  const entryIds = new Set(participants.map((p) => p.entryId))
  const snapshot = await prisma.$transaction((tx) =>
    loadFullScheduleSnapshot(tx, { adminPreview: true }),
  )

  const matchingBouts = snapshot.grouped.mats.flatMap((mat) =>
    mat.bouts
      .filter((bout) => {
        const sides = [bout.sideA, bout.sideB]
        return sides.some(
          (side) => side.kind === 'athlete' && entryIds.has(side.entryId),
        )
      })
      .map((bout) => ({
        matIndex: mat.matIndex,
        boutId: bout.id,
        categoryKey: bout.categoryKey,
        matchNumber: bout.matchNumber,
        sideA: bout.sideA,
        sideB: bout.sideB,
      })),
  )

  const boutIds = matchingBouts.map((b) => b.boutId)
  const executions = await prisma.boutScheduleExecution.findMany({
    where: { boutId: { in: boutIds } },
  })
  const results = await prisma.boutResult.findMany({
    where: { boutId: { in: boutIds }, isCurrent: true },
  })
  const sessions = await prisma.matControlSession.findMany()

  const matSnapshots = await Promise.all(
    sessions.map(async (session) => ({
      matIndex: session.matIndex,
      snapshot: await getMatControlSnapshot(session.matIndex),
    })),
  )

  console.log(
    JSON.stringify(
      {
        participants: participants.map((p) => ({
          entryId: p.entryId,
          name: p.snapshotDisplayName,
          categoryKey: p.draw.categoryKey,
        })),
        matchingBouts,
        executions,
        results,
        sessions,
        matSnapshots: matSnapshots.map(({ matIndex, snapshot: s }) => ({
          matIndex,
          sessionActiveBoutId: s.session.activeBoutId,
          activeBoutId: s.activeBout?.boutId,
          activeBoutPhase: s.activeBout?.execution.boutPhase,
          activeBoutActualEndAt: s.activeBout?.execution.actualEndAt,
          nextAvailable: s.queue.nextAvailable
            ? {
                boutId: s.queue.nextAvailable.bout.id,
                blockedReason: s.queue.nextAvailable.blockedReason,
              }
            : null,
          pendingMatBoutIds: s.pendingMatBoutIds,
        })),
      },
      null,
      2,
    ),
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
