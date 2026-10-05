'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { withBasePath } from '@/lib/basePath'
import { formatBoutTime, formatBoutTimeRange } from '@/lib/bouts/startTimes'
import { TOURNAMENT_TIMEZONE } from '@/lib/config/tournament'
import { AdminMatScheduleRange } from '@/components/admin/bouts/AdminMatScheduleRange'
import type { BoutTiming, StageTimingSummary } from '@/lib/bouts/scheduleTypes'
import type { BoutCardData } from '@/components/tournament/BoutCard'
import { Button } from '@/components/ui/Button'
import { BoutDisplayStatusBadge } from '@/components/admin/bouts/BoutDisplayStatusBadge'
import { resolveBoutDisplayStatusFromTiming } from '@/lib/bouts/presentation/boutDisplayStatus'
import { AdminBoutsParticipantsCell } from '@/components/admin/bouts/AdminBoutsParticipantsCell'
import { AdminBoutScheduleActions } from '@/components/admin/bouts/AdminBoutScheduleActions'
import { selectLiveWindowBouts } from '@/lib/bouts/selectLiveWindowBouts'
import {
  buildScheduleRowsWithStageDividers,
  formatStageSummariesHeader,
} from '@/lib/bouts/stageScheduleDividers'
import { Table } from '@/components/ui/Table'
import { cn } from '@/lib/cn'
import {
  adminBoutsCellCategory,
  adminBoutsRowActions,
  adminBoutsLiveFootnote,
  adminBoutsLiveGrid,
  adminBoutsLiveMat,
  adminBoutsLiveMatHead,
  adminBoutsScrollPanel,
  adminBoutsScrollPanelLive,
  adminPanel,
  adminPanelHeader,
  adminTableWrap,
} from '@/lib/ui/adminSurfaceStyles'

interface AdminLiveBout extends BoutCardData {
  competitionStage: number
  timing: BoutTiming
  isNextStartable?: boolean
}

interface AdminLiveMat {
  matIndex: number
  configuredStartTime: string
  estimatedEndAt: string | null
  bouts: AdminLiveBout[]
}

interface AdminBoutsLiveScheduleProps {
  mats: AdminLiveMat[]
  stageSummaries?: StageTimingSummary[]
  saving: boolean
  onStart: (boutId: string, matIndex: number) => Promise<void>
  onComplete: (boutId: string, matIndex: number) => Promise<void>
  onUndo: (boutId: string, matIndex: number) => Promise<void>
}

function formatAdminTiming(timing: BoutTiming): string {
  if (timing.status === 'completed' && timing.actualStartAt && timing.actualEndAt) {
    return formatBoutTimeRange(timing.actualStartAt, timing.actualEndAt, TOURNAMENT_TIMEZONE)
  }
  if (timing.status === 'in_progress') {
    const start = timing.actualStartAt
      ? formatBoutTimeRange(timing.actualStartAt, timing.actualStartAt, TOURNAMENT_TIMEZONE).split('–')[0]
      : '—'
    return `с ${start}`
  }
  return `≈${formatBoutTimeRange(timing.estimatedStartAt, timing.estimatedEndAt, TOURNAMENT_TIMEZONE)}`
}

export function AdminBoutsLiveSchedule({
  mats,
  stageSummaries = [],
  saving,
  onStart,
  onComplete,
  onUndo,
}: AdminBoutsLiveScheduleProps) {
  const stageSummaryHeader = useMemo(
    () => formatStageSummariesHeader(stageSummaries),
    [stageSummaries],
  )

  return (
    <section className={`${adminPanel} overflow-hidden`}>
      <div className={adminPanelHeader}>
        <div>Live-управление</div>
        {stageSummaryHeader ? (
          <p className="mt-1 text-xs font-normal text-muted">{stageSummaryHeader}</p>
        ) : null}
      </div>

      {mats.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">
          Нет поединков для live-управления. Опубликуйте сетки и настройте тайминг.
        </p>
      ) : (
        <div className={adminBoutsLiveGrid}>
          {mats.map((mat) => {
            const { visible: liveBouts, hiddenCount } = selectLiveWindowBouts(mat.bouts)
            const scheduleRows = buildScheduleRowsWithStageDividers(
              liveBouts.map((bout) => ({
                ...bout,
                competitionStage: bout.competitionStage ?? 1,
              })),
              stageSummaries,
            )

            return (
              <div key={mat.matIndex} className={adminBoutsLiveMat}>
                <div className={adminBoutsLiveMatHead}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Ковёр {mat.matIndex}</p>
                    <AdminMatScheduleRange
                      startTime={mat.configuredStartTime}
                      endTime={
                        mat.estimatedEndAt
                          ? formatBoutTime(mat.estimatedEndAt, TOURNAMENT_TIMEZONE)
                          : null
                      }
                    />
                  </div>
                  <Link href={withBasePath(`/admin/bouts/mats/${mat.matIndex}/control`)}>
                    <Button type="button" variant="secondary">
                      Открыть рабочее место
                    </Button>
                  </Link>
                </div>

                <div
                  className={cn(
                    adminTableWrap,
                    adminBoutsScrollPanel,
                    adminBoutsScrollPanelLive,
                    '[&_table]:w-full [&_table]:min-w-0 max-sm:[&_.admin-bouts-live-col-time]:hidden max-sm:[&_td]:px-3 max-sm:[&_td]:py-2.5 max-sm:[&_th]:px-3 max-sm:[&_th]:py-2.5',
                  )}
                >
                  <Table>
                    <thead>
                      <tr>
                        <th>Категория</th>
                        <th>Участники</th>
                        <th className="admin-bouts-live-col-time w-28">Время</th>
                        <th className="w-24">Статус</th>
                        <th className="w-[11rem] text-right">
                          <span className="sr-only">Действия</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleRows.map((row) => {
                        if (row.kind === 'stage-divider') {
                          return (
                            <tr key={`stage-${row.presentation.stage}`} className="bg-muted/20">
                              <td colSpan={5} className="px-3 py-2">
                                <p className="text-xs font-semibold text-foreground">
                                  {row.presentation.title}
                                </p>
                                {row.presentation.details.length > 0 ? (
                                  <p className="mt-0.5 text-[11px] text-muted">
                                    {row.presentation.details.join(' · ')}
                                  </p>
                                ) : null}
                              </td>
                            </tr>
                          )
                        }

                        const bout = row.bout
                        const displayStatus = resolveBoutDisplayStatusFromTiming(bout.timing)
                        return (
                          <tr key={bout.id}>
                            <td>
                              <div className={adminBoutsCellCategory}>{bout.categoryTitle}</div>
                            </td>
                            <td>
                              <AdminBoutsParticipantsCell sideA={bout.sideA} sideB={bout.sideB} />
                            </td>
                            <td className="admin-bouts-live-col-time text-sm text-muted">
                              {formatAdminTiming(bout.timing)}
                            </td>
                            <td>
                              <BoutDisplayStatusBadge timing={bout.timing} />
                            </td>
                            <td className="text-right">
                              <div className={adminBoutsRowActions}>
                                <AdminBoutScheduleActions
                                  matIndex={mat.matIndex}
                                  boutId={bout.id}
                                  sideA={bout.sideA}
                                  sideB={bout.sideB}
                                  displayStatus={displayStatus}
                                />
                                {displayStatus === 'preparing' || displayStatus === 'scheduled' ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    className="min-h-8 whitespace-nowrap px-2.5 py-1 text-xs"
                                    disabled={saving || bout.isNextStartable !== true}
                                    title={
                                      bout.isNextStartable !== true
                                        ? 'Можно начать только следующий поединок в очереди'
                                        : undefined
                                    }
                                    onClick={() => void onStart(bout.id, mat.matIndex)}
                                  >
                                    Начать
                                  </Button>
                                ) : null}
                                {displayStatus === 'in_progress' ? (
                                  <Button
                                    type="button"
                                    className="min-h-8 whitespace-nowrap px-2.5 py-1 text-xs"
                                    disabled={saving}
                                    onClick={() => void onComplete(bout.id, mat.matIndex)}
                                  >
                                    Завершить
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </Table>
                </div>
                {hiddenCount > 0 ? (
                  <p className={adminBoutsLiveFootnote}>
                    Ещё {hiddenCount} поединков на этом ковре — полное расписание ниже.
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
