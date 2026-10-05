import { getAdminSessionRole } from '@/lib/auth'
import type { BoutSideData } from '@/components/tournament/BoutCard'
import { getJudgeTimelineEvents } from '@/components/admin/bouts/mat-control/judge/formatJudgeTimelineEntry'
import type { AdminBoutPanelOverview, AdminBoutPanelTimelineEntry } from './adminBoutPanel'
import { loadBoutCorrectionMeta } from './boutCorrectionMeta'
import { BoutNotFoundError } from './mat-control/errors'
import {
  buildParticipantContext,
  findBoutInSchedule,
  loadBoutEvents,
} from './matControlContext'
import {
  createDefaultExecutionData,
  mapEventRow,
  mapExecutionRow,
} from './matControlMappers'
import { buildBoutSnapshot } from './matControlSnapshot'
import { prisma } from '@/lib/prisma'
import { buildScheduledMats, readFullScheduleSnapshot } from './scheduleService'
import { resolveMatBoutDisplayStatuses } from './presentation/boutDisplayStatus'
import { reduceScoreEvents } from './scoreEngine'
import type { InternalBoutSide } from './types'

function mapInternalSide(side: InternalBoutSide): BoutSideData {
  if (side.kind === 'athlete') {
    return {
      kind: 'athlete',
      displayName: side.displayName,
      clubName: side.clubName,
    }
  }
  if (side.kind === 'hint') {
    return { kind: 'hint', label: side.label }
  }
  return { kind: 'bye' }
}

export async function getAdminBoutPanelOverview(boutId: string): Promise<AdminBoutPanelOverview> {
  const sessionRole = await getAdminSessionRole()
  if (!sessionRole) {
    throw new Error('Unauthorized')
  }

  const snapshot = await readFullScheduleSnapshot({ adminPreview: true })
  if (!snapshot.published) {
    throw new BoutNotFoundError('Расписание поединков ещё не опубликовано')
  }

  const located = findBoutInSchedule(boutId, snapshot.grouped)
  const now = new Date()
  const scheduledBout = buildScheduledMats({
    grouped: snapshot.grouped,
    snapshot,
    now,
  })
    .mats.flatMap((mat) => mat.bouts)
    .find((bout) => bout.id === boutId)

  return prisma.$transaction(async (tx) => {
    let execution = await tx.boutScheduleExecution.findUnique({ where: { boutId } })
    if (!execution) {
      execution = await tx.boutScheduleExecution.create({
        data: createDefaultExecutionData(boutId),
      })
    }

    const eventRows = await loadBoutEvents(tx, boutId)
    const events = eventRows.map(mapEventRow)
    const correctionMeta = await loadBoutCorrectionMeta(tx, located.bout)
    const boutSnapshot = buildBoutSnapshot({
      bout: located.bout,
      execution: mapExecutionRow(execution),
      participants: buildParticipantContext(located.bout, execution.liveSnapshot),
      events,
      durationOverrides: snapshot.settings.ageDivisionDurationOverrides,
      correctionMeta,
      now,
    })

    const displayStatuses = resolveMatBoutDisplayStatuses({
      orderedBoutIds: [boutId],
      executions: new Map([[boutId, execution]]),
    })

    const mainScore = reduceScoreEvents(
      events,
      'main',
      boutSnapshot.execution.attemptNumber,
    )
    const extraScore =
      boutSnapshot.execution.currentPeriod === 'extra' ||
      boutSnapshot.decisionPreview?.decidedInPeriod === 'extra'
        ? reduceScoreEvents(events, 'extra', boutSnapshot.execution.attemptNumber)
        : null

    return {
      boutId,
      matIndex: located.matIndex,
      categoryTitle: located.bout.categoryTitle,
      matchLabel:
        scheduledBout?.scheduleDisplayNumber != null
          ? `Бой ${scheduledBout.scheduleDisplayNumber}`
          : located.bout.label ?? null,
      sideA: mapInternalSide(scheduledBout?.sideA ?? located.bout.sideA),
      sideB: mapInternalSide(scheduledBout?.sideB ?? located.bout.sideB),
      boutPhase: boutSnapshot.execution.boutPhase,
      displayStatus: displayStatuses.get(boutId) ?? 'scheduled',
      score:
        boutSnapshot.execution.boutPhase === 'scheduled' && events.length === 0
          ? null
          : {
              red: mainScore.officialScore.red,
              blue: mainScore.officialScore.blue,
              extraRed: extraScore?.officialScore.red ?? null,
              extraBlue: extraScore?.officialScore.blue ?? null,
            },
      confirmationSummary: boutSnapshot.confirmationSummary,
      timeline: getJudgeTimelineEvents(events, boutSnapshot.execution.attemptNumber).map(
        (entry): AdminBoutPanelTimelineEntry => ({
          id: entry.id,
          headline: entry.headline,
          subtitle: entry.subtitle,
          boutTime: entry.boutTime,
        }),
      ),
      canCorrectResult: sessionRole === 'admin',
      hasEvents: events.some((event) => !event.undoneAt),
    }
  })
}
