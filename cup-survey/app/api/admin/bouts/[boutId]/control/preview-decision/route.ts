import { verifyMatControlSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { buildParticipantContext, findBoutInSchedule, loadBoutEvents } from '@/lib/bouts/matControlContext'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { mapEventRow, mapExecutionRow } from '@/lib/bouts/matControlMappers'
import { PreviewDecisionSchema } from '@/lib/bouts/matControlSchemas'
import { resolveBoutDecision } from '@/lib/bouts/scoreEngine'
import { readFullScheduleSnapshot } from '@/lib/bouts/scheduleService'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(
  request: Request,
  context: { params: Promise<{ boutId: string }> },
) {
  if (!(await verifyMatControlSession())) {
    return matControlJson({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, 401)
  }

  try {
    const { boutId } = await context.params
    const body = await request.json()
    const parsed = PreviewDecisionSchema.safeParse(body)
    if (!parsed.success) {
      return matControlJson(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        400,
      )
    }

    const snapshot = await readFullScheduleSnapshot({ adminPreview: true })
    const { bout } = findBoutInSchedule(boutId, snapshot.grouped)
    const execution = await prisma.boutScheduleExecution.findUnique({ where: { boutId } })
    const attemptNumber = execution?.attemptNumber ?? 1
    const period = parsed.data.period ?? execution?.currentPeriod ?? 'main'
    const events = (await loadBoutEvents(prisma, boutId)).map(mapEventRow)
    const participants = buildParticipantContext(
      bout,
      execution ? mapExecutionRow(execution).liveSnapshot : undefined,
    )

    const decision = resolveBoutDecision({
      events,
      period: period === 'extra' ? 'extra' : 'main',
      attemptNumber,
      participants,
    })

    return matControlJson({ decision })
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
