'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BalanceDelta, DrawBalanceReport } from '@/lib/brackets/core/drawBalanceHelpers'
import type { PublicationStateDto } from '@/lib/brackets/generation/publicationState'
import { genderFromAgeDivisionId } from '@/lib/brackets/publicCategoryFilters'
import { parseRegistrationCategoryKey } from '@/lib/registration/categoryIdentity'
import {
  useMoveEntryMutation,
  useRedrawBracketsMutation,
  useResetEntryMutation,
  useUpdateDrawMutation,
  useVisibilityMutation,
} from '@/lib/brackets/admin/hooks'
import { AdminBracketCategoryHeader } from './AdminBracketCategoryHeader'
import { AdminBracketDrawBalancePanel } from './AdminBracketDrawBalancePanel'
import { AdminBracketFormatControls } from './AdminBracketFormatControls'
import { AdminBracketMatControl } from './AdminBracketMatControl'
import { AdminBracketStageControl } from './AdminBracketStageControl'
import type { CompetitionStageSettings } from '@/lib/bouts/competitionStageSettings'
import { AdminBracketMoveEntryForm } from './AdminBracketMoveEntryForm'
import { AdminBracketParticipantsSection } from './AdminBracketParticipantsSection'

export interface CategoryParticipant {
  id: string
  entryId: string
  seedPosition: number
  seedLocked: boolean
  displayName: string
  clubName: string
  clubKey?: string | null
  cityKey?: string | null
  strengthTier?: number | null
  gender?: 'male' | 'female' | null
  isManualMove: boolean
}

export interface CategoryPanelData {
  id: string
  categoryKey: string
  title: string
  status: string
  statusReason: string | null
  autoSystemId: string | null
  systemOverride: string | null
  autoBronzeMode: 'ONE' | 'TWO' | null
  bronzeModeOverride: 'ONE' | 'TWO' | null
  effectiveSystemId: string | null
  effectiveBronzeMode: 'ONE' | 'TWO' | null
  allowedSystemIds: string[]
  formatRuleLabel: string | null
  compositionStale: boolean
  seedingStale: boolean
  balanceStale: boolean
  publicVisible: boolean
  boutsReleased?: boolean
  boutsRepairRequired?: boolean
  matIndex: number | null
  competitionStage: number
  competitionStageEligibility?: Record<number, boolean>
  publicationState?: PublicationStateDto
  drawBalanceReport?: import('@/lib/brackets/core/drawBalanceHelpers').DrawBalanceReport | null
  participants: CategoryParticipant[]
  diff?: {
    added: Array<{ entryId: string; displayName: string }>
    removed: Array<{ entryId: string; displayName: string }>
    moved: Array<{ entryId: string; fromCategoryKey: string; toCategoryKey: string }>
  }
}

interface AdminBracketCategoryPanelProps {
  category: CategoryPanelData
  draftId: string
  draftVersion: number
  allCategoryKeys: Array<{ key: string; title: string; participantCount: number }>
  onToast: (message: string, type?: 'error' | 'success') => void
  onDraftChange: (draft: { id: string; version: number }) => void
  globalCompositionStale: boolean
  controlsEnabled: boolean
  independentBoutsRelease?: boolean
  matCount: number
  autoMatAssignMode: import('@/lib/bouts/autoMatMode').AutoMatAssignMode
  autoMatByCategoryEnabled: boolean
  configuredCategoryStages: number[]
  competitionStageSettings: CompetitionStageSettings
  scheduleVersion: number
  onScheduleVersionChange: (scheduleVersion: number) => void
  onDashboardRefresh?: () => void
  onCategoryVisibilityChange?: (visible: boolean) => void
  onCategoryBoutsReleaseChange?: (released: boolean) => void
  onForceRebuild?: (categoryKeys: string[]) => void
}

export function AdminBracketCategoryPanel({
  category,
  draftId,
  draftVersion,
  allCategoryKeys,
  onToast,
  onDraftChange,
  globalCompositionStale,
  controlsEnabled,
  independentBoutsRelease = false,
  matCount,
  autoMatAssignMode,
  autoMatByCategoryEnabled,
  configuredCategoryStages,
  competitionStageSettings,
  scheduleVersion,
  onScheduleVersionChange,
  onDashboardRefresh,
  onCategoryVisibilityChange,
  onCategoryBoutsReleaseChange,
  onForceRebuild,
}: AdminBracketCategoryPanelProps) {
  const [moveEntryId, setMoveEntryId] = useState<string | null>(null)
  const [moveTargetKey, setMoveTargetKey] = useState('')
  const [drawBalanceReport, setDrawBalanceReport] = useState<DrawBalanceReport | null>(null)
  const [balanceDelta, setBalanceDelta] = useState<BalanceDelta | null>(null)

  const updateDrawMutation = useUpdateDrawMutation(category.id, category.categoryKey)
  const redrawMutation = useRedrawBracketsMutation()
  const visibilityMutation = useVisibilityMutation()
  const moveEntryMutation = useMoveEntryMutation()
  const resetEntryMutation = useResetEntryMutation()

  useEffect(() => {
    setDrawBalanceReport(category.drawBalanceReport ?? null)
    setBalanceDelta(null)
  }, [category.categoryKey, category.drawBalanceReport])

  const busy =
    updateDrawMutation.isPending ||
    redrawMutation.isPending ||
    visibilityMutation.isPending ||
    moveEntryMutation.isPending ||
    resetEntryMutation.isPending

  const movingParticipant = useMemo(
    () => category.participants.find((participant) => participant.entryId === moveEntryId) ?? null,
    [category.participants, moveEntryId],
  )

  const movingAthleteGender = useMemo((): 'male' | 'female' => {
    if (movingParticipant?.gender) return movingParticipant.gender
    const identity = parseRegistrationCategoryKey(category.categoryKey)
    return identity ? genderFromAgeDivisionId(identity.ageDivisionId) : 'male'
  }, [category.categoryKey, movingParticipant?.gender])

  const patchDraw = async (body: Record<string, unknown>) => {
    try {
      const result = await updateDrawMutation.mutateAsync({
        draftId,
        expectedVersion: draftVersion,
        ...body,
      })
      onDraftChange(result.draft)
      if (result.drawBalanceReport) setDrawBalanceReport(result.drawBalanceReport)
      else if (result.category?.drawBalanceReport) setDrawBalanceReport(result.category.drawBalanceReport)
      if (result.balanceDelta) setBalanceDelta(result.balanceDelta)
      return true
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Ошибка операции', 'error')
      return false
    }
  }

  const onRedraw = async () => {
    try {
      const result = await redrawMutation.mutateAsync({
        draftId,
        expectedVersion: draftVersion,
        scope: 'category',
        categoryKey: category.categoryKey,
      })
      onDraftChange(result.draft)
      if (result.drawBalanceReport) setDrawBalanceReport(result.drawBalanceReport)
      setBalanceDelta(null)
      onToast('Жеребьёвка категории выполнена', 'success')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Ошибка операции', 'error')
    }
  }

  const onShowOnSite = async () => {
    if (category.publicVisible) return
    try {
      if (onCategoryVisibilityChange) {
        await onCategoryVisibilityChange(true)
        return
      }
      await visibilityMutation.mutateAsync({
        scope: 'category',
        categoryKey: category.categoryKey,
        visible: true,
      })
      onToast('Категория показана на сайте', 'success')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Ошибка операции', 'error')
    }
  }

  const onHideFromSite = async () => {
    if (!category.publicVisible) return
    try {
      if (onCategoryVisibilityChange) {
        await onCategoryVisibilityChange(false)
        return
      }
      await visibilityMutation.mutateAsync({
        scope: 'category',
        categoryKey: category.categoryKey,
        visible: false,
      })
      onToast('Категория скрыта с сайта', 'success')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Ошибка операции', 'error')
    }
  }

  const onReleaseToSchedule = async () => {
    if (category.boutsReleased) return
    try {
      if (onCategoryBoutsReleaseChange) {
        await onCategoryBoutsReleaseChange(true)
        return
      }
      onToast('Ошибка операции', 'error')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Ошибка операции', 'error')
    }
  }

  const onUnreleaseFromSchedule = async () => {
    if (!category.boutsReleased) return
    try {
      if (onCategoryBoutsReleaseChange) {
        await onCategoryBoutsReleaseChange(false)
        return
      }
      onToast('Ошибка операции', 'error')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Ошибка операции', 'error')
    }
  }

  const moveEntry = async () => {
    if (!moveEntryId || !moveTargetKey) return
    try {
      const result = await moveEntryMutation.mutateAsync({
        draftId,
        expectedVersion: draftVersion,
        entryId: moveEntryId,
        targetCategoryKey: moveTargetKey,
      })
      onDraftChange(result.draft)
      setMoveEntryId(null)
      setMoveTargetKey('')
      onToast('Участник перенесён', 'success')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Ошибка операции', 'error')
    }
  }

  const resetPlacement = async (entryId: string) => {
    try {
      const result = await resetEntryMutation.mutateAsync({
        draftId,
        expectedVersion: draftVersion,
        entryId,
      })
      onDraftChange(result.draft)
      onToast('Перенос сброшен', 'success')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Ошибка операции', 'error')
    }
  }

  const patchParticipants = async (
    participants: Array<{ entryId: string; seedPosition: number; seedLocked: boolean }>,
  ) => patchDraw({ participants })

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <AdminBracketCategoryHeader
        category={category}
        busy={busy}
        globalCompositionStale={globalCompositionStale}
        controlsEnabled={controlsEnabled}
        independentBoutsRelease={independentBoutsRelease}
        matCount={matCount}
        onRedraw={() => void onRedraw()}
        onShowOnSite={() => void onShowOnSite()}
        onHideFromSite={() => void onHideFromSite()}
        onReleaseToSchedule={
          onCategoryBoutsReleaseChange ? () => void onReleaseToSchedule() : undefined
        }
        onUnreleaseFromSchedule={
          onCategoryBoutsReleaseChange ? () => void onUnreleaseFromSchedule() : undefined
        }
        onForceRebuild={
          onForceRebuild ? () => onForceRebuild([category.categoryKey]) : undefined
        }
        />
      </div>

      <div className="print:hidden">
        <AdminBracketDrawBalancePanel report={drawBalanceReport} balanceDelta={balanceDelta} />
      </div>

      <div className="print:hidden">
        <AdminBracketFormatControls
        category={category}
        busy={busy}
        disabled={!controlsEnabled || category.status !== 'ACTIVE'}
        onSaveOverrides={(systemOverride, bronzeModeOverride) =>
          void patchDraw({ systemOverride, bronzeModeOverride })
        }
        />
      </div>

      <div className="print:hidden">
        <AdminBracketStageControl
          drawId={category.id}
          draftId={draftId}
          draftVersion={draftVersion}
          scheduleVersion={scheduleVersion}
          competitionStage={category.competitionStage}
          configuredCategoryStages={configuredCategoryStages}
          stageSettings={competitionStageSettings}
          competitionStageEligibility={category.competitionStageEligibility}
          busy={busy}
          onDraftChange={onDraftChange}
          onScheduleVersionChange={onScheduleVersionChange}
          onToast={onToast}
          onUpdated={onDashboardRefresh}
        />
      </div>

      <div className="print:hidden">
        <AdminBracketMatControl
        drawId={category.id}
        draftId={draftId}
        draftVersion={draftVersion}
        matIndex={category.matIndex ?? null}
        matCount={matCount}
        autoMatAssignMode={autoMatAssignMode}
        autoMatByCategoryEnabled={autoMatByCategoryEnabled}
        busy={busy}
        onDraftChange={onDraftChange}
        onToast={onToast}
        onUpdated={onDashboardRefresh}
        />
      </div>

      {category.diff && (
        <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted print:hidden">
          Изменения состава: добавлено {category.diff.added.length}, удалено {category.diff.removed.length},
          перенесено {category.diff.moved.length}
        </p>
      )}

      <AdminBracketParticipantsSection
        category={category}
        allCategoryKeys={allCategoryKeys}
        disabled={busy}
        onPatchParticipants={patchParticipants}
        onToggleLock={async (entryId, seedLocked) => {
          const sorted = [...category.participants].sort((a, b) => a.seedPosition - b.seedPosition)
          const participants = sorted.map((participant) => ({
            entryId: participant.entryId,
            seedPosition: participant.seedPosition,
            seedLocked: participant.entryId === entryId ? !seedLocked : participant.seedLocked,
          }))
          await patchParticipants(participants)
        }}
        onMoveEntry={(entryId) => {
          setMoveEntryId(entryId)
          setMoveTargetKey('')
        }}
        onResetPlacement={(entryId) => void resetPlacement(entryId)}
        onToast={onToast}
      />

      <AdminBracketMoveEntryForm
        key={moveEntryId ?? 'closed'}
        open={Boolean(moveEntryId)}
        allCategoryKeys={allCategoryKeys}
        athleteGender={movingAthleteGender}
        currentCategoryKey={category.categoryKey}
        participantName={movingParticipant?.displayName ?? 'Участник'}
        busy={busy}
        onTargetChange={setMoveTargetKey}
        onConfirm={() => void moveEntry()}
        onCancel={() => {
          setMoveEntryId(null)
          setMoveTargetKey('')
        }}
      />
    </div>
  )
}
