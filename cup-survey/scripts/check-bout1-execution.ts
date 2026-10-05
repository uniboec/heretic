import { prisma } from '../lib/prisma'
import { loadFullScheduleSnapshot } from '../lib/bouts/scheduleService'

const boutId = 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_52::bout-1'

async function main() {
  await prisma.$transaction(async (tx) => {
    const snapshot = await loadFullScheduleSnapshot(tx, { adminPreview: true })
    const snapshotExec = snapshot.executions.find((e) => e.boutId === boutId)
    const row = await tx.boutScheduleExecution.findUnique({ where: { boutId } })
    console.log(
      JSON.stringify(
        {
          snapshotExec,
          dbRow: {
            actualEndAt: row?.actualEndAt,
            boutPhase: row?.boutPhase,
            liveRevision: row?.liveRevision,
          },
        },
        null,
        2,
      ),
    )
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
