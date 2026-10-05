'use client'

import { Button } from '@/components/ui/Button'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { cn } from '@/lib/cn'
import { resolveStageUiRange } from '@/lib/bouts/competitionStages'
import { isCompetitionStageControlLocked } from '@/lib/bouts/competitionStageEligibility'
import type { CompetitionStageSettings } from '@/lib/bouts/competitionStageSettings'

interface AdminBracketStageControlProps {
  drawId: string
  draftId: string
  draftVersion: number
  scheduleVersion: number
  competitionStage: number
  configuredCategoryStages: number[]
  stageSettings: CompetitionStageSettings
  competitionStageEligibility?: Record<number, boolean>
  busy: boolean
  onDraftChange: (draft: { id: string; version: number }) => void
  onScheduleVersionChange: (scheduleVersion: number) => void
  onToast: (message: string, type?: 'error' | 'success') => void
  onUpdated?: () => void
}

const LOCKED_TOOLTIP = 'Категория уже началась — этап нельзя изменить'

export function AdminBracketStageControl({
  drawId,
  draftId,
  draftVersion,
  scheduleVersion,
  competitionStage,
  configuredCategoryStages,
  stageSettings,
  competitionStageEligibility,
  busy,
  onDraftChange,
  onScheduleVersionChange,
  onToast,
  onUpdated,
}: AdminBracketStageControlProps) {
  const { maxSelectable } = resolveStageUiRange({
    configuredCategoryStages,
    stageSettings,
  })
  const stageChangeLocked = isCompetitionStageControlLocked(
    competitionStage,
    competitionStageEligibility,
  )

  async function patchCompetitionStage(nextStage: number) {
    if (stageChangeLocked || competitionStageEligibility?.[nextStage] === false) {
      onToast(LOCKED_TOOLTIP, 'error')
      return
    }

    const res = await fetch(withBasePath(`/api/admin/brackets/draws/${drawId}/competition-stage`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId,
        expectedVersion: draftVersion,
        expectedScheduleVersion: scheduleVersion,
        competitionStage: nextStage,
      }),
    })
    const result = await readJsonResponse<{
      error?: string
      draft?: { id: string; version: number }
      scheduleVersion?: number
    }>(res)
    if (!result.ok) {
      onToast(result.error ?? 'Не удалось сохранить этап', 'error')
      return
    }
    const json = result.data
    if (json.draft) onDraftChange(json.draft)
    if (typeof json.scheduleVersion === 'number') {
      onScheduleVersionChange(json.scheduleVersion)
    }
    onUpdated?.()
    onToast('Этап сохранён', 'success')
  }

  const stages = Array.from({ length: maxSelectable }, (_, index) => index + 1)

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Этап проведения</p>
      <p className="text-xs text-muted">
        Все поединки категории проводятся в выбранном этапе. Следующий этап начнётся после
        завершения предыдущего на всех коврах.
      </p>
      {stageChangeLocked ? (
        <p className="text-xs text-warning-foreground" title={LOCKED_TOOLTIP}>
          {LOCKED_TOOLTIP}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {stages.map((stage) => {
          const selected = competitionStage === stage
          const allowed = competitionStageEligibility?.[stage] ?? true
          const disabled = busy || stageChangeLocked || (!selected && !allowed)
          return (
            <Button
              key={stage}
              type="button"
              variant={selected ? 'primary' : 'secondary'}
              disabled={disabled}
              title={!allowed && !selected ? LOCKED_TOOLTIP : undefined}
              className={cn(selected && 'pointer-events-none')}
              onClick={() => patchCompetitionStage(stage)}
            >
              Этап {stage}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
