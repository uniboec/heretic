'use client'

import {
  adminCards,
  adminConsolidationActionBadge,
  adminConsolidationAddAction,
  adminConsolidationSelect,
  adminConsolidationSelectGrow,
  adminConsolidationSelectWide,
  adminConsolidationTableWrap,
  adminModal,
  adminModalBody,
  adminModalClose,
  adminModalConsolidation,
  adminModalFooter,
  adminModalHead,
  adminModalSubtitle,
  adminModalTitle,
  adminPanel,
  adminPanelHeader,
} from '@/lib/ui/adminSurfaceStyles'
import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Table } from '@/components/ui/Table'
import { cn } from '@/lib/cn'
import type {
  ConsolidationAction,
  ConsolidationEntrySummary,
  ConsolidationPlan,
  ConsolidationPolicy,
  ConsolidationStep,
  ConsolidationStepType,
  WeightMappingMode,
} from '@/lib/brackets/consolidation/types'
import type { CategoryLockLevel } from '@/lib/brackets/live/guard'
import {
  BRACKET_CONSOLIDATION_LABELS,
  BRACKET_CONSOLIDATION_STEP_LABELS,
  BRACKET_CONSOLIDATION_VALIDATION_LABELS,
  BRACKET_CONSOLIDATION_WEIGHT_MAPPING_LABELS,
  BRACKET_IMPACT_CONFIRM,
  formatConsolidationActionLabel,
  formatConsolidationWaveActions,
} from '@/lib/brackets/labels'
import { getCategoryTitleFromKey } from '@/lib/registration/categoryIdentity'
import { applyConsolidationPolicyChange } from './consolidationDialogState'
import {
  createPresetWave,
  createSingleActionWave,
  getAvailableActionTypes,
  hasActiveConsolidationWaves,
  validateStepActionsClient,
} from './consolidationClientDefaults'
import { loadConsolidationPolicy, saveConsolidationPolicy } from './consolidationPolicyStorage'

const ALL_WAVE_TYPES: ConsolidationStepType[] = [
  'EXPERIENCE_UP',
  'WEIGHT_UP',
  'WEIGHT_DOWN',
  'AGE_UP',
]

type ConsolidationPreviewState = {
  plan: ConsolidationPlan
  policy: ConsolidationPolicy
  entries: ConsolidationEntrySummary[]
  consolidationPlanToken: string
  impactToken?: string
  impact?: {
    affectedCategoryKeys: string[]
    lockLevels: Record<string, CategoryLockLevel>
    totalCategoryCount: number
  }
}

interface AdminBracketConsolidationDialogProps {
  open: boolean
  busy: boolean
  onClose: () => void
  onPreview: (policy: ConsolidationPolicy) => Promise<ConsolidationPreviewState>
  onRequestApply: (input: {
    policy: ConsolidationPolicy
    consolidationPlanToken: string
    impactToken?: string
    impact?: ConsolidationPreviewState['impact']
  }) => void
}

function supportsRepeat(type: ConsolidationStepType): boolean {
  return type === 'WEIGHT_UP' || type === 'WEIGHT_DOWN' || type === 'AGE_UP'
}

function updateStepAt(
  policy: ConsolidationPolicy,
  index: number,
  updater: (step: ConsolidationStep) => ConsolidationStep,
): ConsolidationPolicy {
  return {
    ...policy,
    steps: policy.steps.map((step, stepIndex) => (stepIndex === index ? updater(step) : step)),
  }
}

export function AdminBracketConsolidationDialog({
  open,
  busy,
  onClose,
  onPreview,
  onRequestApply,
}: AdminBracketConsolidationDialogProps) {
  const [policy, setPolicyState] = useState<ConsolidationPolicy>(() => loadConsolidationPolicy())
  const [preview, setPreview] = useState<ConsolidationPreviewState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addWaveType, setAddWaveType] = useState<ConsolidationStepType>('EXPERIENCE_UP')
  const [addActionType, setAddActionType] = useState<ConsolidationStepType>('WEIGHT_UP')
  const [dragWaveIndex, setDragWaveIndex] = useState<number | null>(null)
  const [dragOverWaveIndex, setDragOverWaveIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setPolicyState(loadConsolidationPolicy())
    setPreview(null)
    setError(null)
  }, [open])

  const onPolicyChange = (nextPolicy: ConsolidationPolicy) => {
    const next = applyConsolidationPolicyChange(nextPolicy)
    setPolicyState(next.policy)
    setPreview(next.preview)
    setError(next.error)
  }

  const activeWaves = hasActiveConsolidationWaves(policy)
  const activeWaveCount = policy.steps.filter((step) => step.enabled).length
  const movedCount = preview?.plan.finalPlacements.length ?? 0

  const stepValidationErrors = useMemo(
    () =>
      policy.steps.map((step) => {
        if (!step.enabled || step.actions.length === 0) return null
        return validateStepActionsClient(step.actions)
      }),
    [policy.steps],
  )

  const policyValidationError = useMemo(() => {
    const firstError = stepValidationErrors.find((error) => error != null)
    return firstError ?? null
  }, [stepValidationErrors])

  const policyIsValid = policyValidationError == null

  const traceByWave = useMemo(() => {
    if (!preview) return []
    const grouped = new Map<number, typeof preview.plan.trace>()
    for (const hop of preview.plan.trace) {
      const rows = grouped.get(hop.stepIndex) ?? []
      rows.push(hop)
      grouped.set(hop.stepIndex, rows)
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([stepIndex, hops]) => ({
        stepIndex,
        actions: hops[0]?.actions ?? policy.steps[stepIndex]?.actions ?? [],
        hops: [...hops].sort((a, b) => a.hopIndex - b.hopIndex),
      }))
  }, [preview, policy.steps])

  const entryById = useMemo(() => {
    if (!preview) return new Map<string, ConsolidationEntrySummary>()
    return new Map(preview.entries.map((entry) => [entry.entryId, entry]))
  }, [preview])

  const athleteRows = useMemo(() => {
    if (!preview) return []
    return [...preview.plan.finalPlacements]
      .map((placement) => ({
        placement,
        entry: entryById.get(placement.entryId),
      }))
      .sort((a, b) =>
        (a.entry?.displayName ?? a.placement.entryId).localeCompare(
          b.entry?.displayName ?? b.placement.entryId,
          'ru',
        ),
      )
  }, [preview, entryById])

  const skippedRows = useMemo(() => {
    if (!preview) return []
    return preview.plan.skipped.map((item) => ({
      ...item,
      entryIds: item.entryIds ?? [],
    }))
  }, [preview])

  const moveWave = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= policy.steps.length) return
    reorderWave(index, target)
  }

  const reorderWave = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    if (fromIndex < 0 || toIndex < 0) return
    if (fromIndex >= policy.steps.length || toIndex >= policy.steps.length) return
    const steps = [...policy.steps]
    const [item] = steps.splice(fromIndex, 1)
    steps.splice(toIndex, 0, item)
    onPolicyChange({ ...policy, steps })
  }

  const removeWave = (index: number) => {
    if (policy.steps.length <= 1) return
    onPolicyChange({
      ...policy,
      steps: policy.steps.filter((_, stepIndex) => stepIndex !== index),
    })
  }

  const addWave = () => {
    onPolicyChange({
      ...policy,
      steps: [...policy.steps, createSingleActionWave(addWaveType)],
    })
  }

  const addPresetWave = (preset: 'experience_weight' | 'age_weight' | 'weight_x2') => {
    onPolicyChange({
      ...policy,
      steps: [...policy.steps, createPresetWave(preset)],
    })
  }

  const updateAction = (
    waveIndex: number,
    actionIndex: number,
    patch: Partial<ConsolidationAction>,
  ) => {
    onPolicyChange(
      updateStepAt(policy, waveIndex, (step) => ({
        ...step,
        actions: step.actions.map((action, index) =>
          index === actionIndex ? { ...action, ...patch } : action,
        ),
      })),
    )
  }

  const removeAction = (waveIndex: number, actionIndex: number) => {
    const step = policy.steps[waveIndex]
    if (!step || step.actions.length <= 1) return
    onPolicyChange(
      updateStepAt(policy, waveIndex, (current) => ({
        ...current,
        actions: current.actions.filter((_, index) => index !== actionIndex),
      })),
    )
  }

  const addActionToWave = (waveIndex: number, type: ConsolidationStepType) => {
    const step = policy.steps[waveIndex]
    if (!step) return
    const available = getAvailableActionTypes(step.actions)
    if (!available.includes(type)) return
    onPolicyChange(
      updateStepAt(policy, waveIndex, (current) => ({
        ...current,
        actions: [
          ...current.actions,
          type === 'AGE_UP'
            ? { type, weightMapping: 'SAME_INDEX' as const }
            : { type },
        ],
      })),
    )
  }

  const runPreview = async () => {
    if (!policyIsValid) {
      setPreview(null)
      setError(
        BRACKET_CONSOLIDATION_VALIDATION_LABELS[policyValidationError ?? ''] ??
          'Исправьте ошибки в волнах перед preview',
      )
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await onPreview(policy)
      setPreview(result)
      saveConsolidationPolicy(policy)
    } catch (previewError) {
      setPreview(null)
      setError(previewError instanceof Error ? previewError.message : 'Ошибка preview')
    } finally {
      setLoading(false)
    }
  }

  const runApply = () => {
    if (!preview || movedCount === 0) return
    onRequestApply({
      policy: preview.policy,
      consolidationPlanToken: preview.consolidationPlanToken,
      impactToken: preview.impactToken,
      impact: preview.impact,
    })
  }

  const handleClose = () => {
    if (loading || busy) return
    onClose()
  }

  const canReorderWaves = !loading && !busy

  const handleWaveDragStart = (index: number, event: React.DragEvent<HTMLLIElement>) => {
    if (!canReorderWaves) {
      event.preventDefault()
      return
    }
    setDragWaveIndex(index)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }

  const handleWaveDragEnd = () => {
    setDragWaveIndex(null)
    setDragOverWaveIndex(null)
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!loading && !busy) onClose()
      }}
      panelClassName={cn(adminModal, adminModalConsolidation)}
      ariaLabelledBy="bracket-consolidation-title"
    >
      <header className={adminModalHead}>
        <div className="min-w-0">
          <h2 id="bracket-consolidation-title" className={adminModalTitle}>
            {BRACKET_CONSOLIDATION_LABELS.dialogTitle}
          </h2>
          <p className={adminModalSubtitle}>
            {BRACKET_CONSOLIDATION_LABELS.dialogDescription}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className={adminModalClose}
          aria-label="Закрыть"
          disabled={loading || busy}
          onClick={handleClose}
        >
          Закрыть
        </Button>
      </header>

      <div className={adminModalBody}>
        <div className="space-y-3">
          <section className={`${adminPanel} overflow-hidden`}>
            <div className={cn(adminPanelHeader, 'flex items-center justify-between gap-3 py-2.5')}>
              <span>{BRACKET_CONSOLIDATION_LABELS.settingsSection}</span>
              <span className="text-xs font-normal text-muted">
                {activeWaveCount}/{policy.steps.length} волн
              </span>
            </div>
            <div className="space-y-3 p-3 sm:p-4">
              <div>
                <label className="block text-sm font-medium">
                  {BRACKET_CONSOLIDATION_LABELS.incompleteThreshold}
                </label>
                <Select
                  controlOnly
                  density="compact"
                  className="mt-1.5 w-full sm:max-w-md"
                  value={policy.incompleteThreshold}
                  onChange={(event) =>
                    onPolicyChange({
                      ...policy,
                      incompleteThreshold: Number(event.target.value) as 1 | 2 | 3,
                    })
                  }
                >
                  <option value={1}>{BRACKET_CONSOLIDATION_LABELS.thresholdOption(1)}</option>
                  <option value={2}>{BRACKET_CONSOLIDATION_LABELS.thresholdOption(2)}</option>
                  <option value={3}>{BRACKET_CONSOLIDATION_LABELS.thresholdOption(3)}</option>
                </Select>
                <p className="mt-1.5 text-xs text-muted">
                  {BRACKET_CONSOLIDATION_LABELS.thresholdSelectedHint(policy.incompleteThreshold)}
                </p>
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{BRACKET_CONSOLIDATION_LABELS.wavesTitle}</p>
                  <p className="text-xs text-muted">Перетащите или используйте стрелки</p>
                </div>
                <p className="mt-1 text-xs text-muted">{BRACKET_CONSOLIDATION_LABELS.finalTargetHint}</p>

                <ul className="mt-2 space-y-2">
                  {policy.steps.map((step, index) => {
                    const isDragging = dragWaveIndex === index
                    const isDropTarget = dragOverWaveIndex === index
                    const availableActionTypes = getAvailableActionTypes(step.actions)
                    const validationError = stepValidationErrors[index]

                    return (
                      <li
                        key={`wave-${index}-${formatConsolidationWaveActions(step.actions)}`}
                        draggable={canReorderWaves}
                        onDragStart={(event) => handleWaveDragStart(index, event)}
                        onDragEnd={handleWaveDragEnd}
                        onDragOver={(event) => {
                          if (!canReorderWaves || dragWaveIndex === null) return
                          event.preventDefault()
                          setDragOverWaveIndex(index)
                        }}
                        onDragLeave={() => {
                          if (dragOverWaveIndex === index) {
                            setDragOverWaveIndex(null)
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          const sourceIndex = dragWaveIndex
                          setDragWaveIndex(null)
                          setDragOverWaveIndex(null)
                          if (sourceIndex === null || sourceIndex === index) return
                          reorderWave(sourceIndex, index)
                        }}
                        className={cn(
                          'rounded-xl border border-border bg-card p-3.5 transition-opacity',
                          !step.enabled && 'opacity-65',
                          isDragging && 'opacity-55',
                          isDropTarget && 'border-accent ring-2 ring-accent/10',
                        )}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span
                                className="inline-flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-muted active:cursor-grabbing"
                                aria-hidden
                              >
                                <GripVertical className="h-4 w-4" />
                              </span>
                              <Input
                                controlOnly
                                type="checkbox"
                                className="shrink-0 w-auto min-h-0 border-0 bg-transparent p-0 shadow-none"
                                checked={step.enabled}
                                aria-label={`Волна ${index + 1}`}
                                onChange={(event) =>
                                  onPolicyChange(
                                    updateStepAt(policy, index, (item) => ({
                                      ...item,
                                      enabled: event.target.checked,
                                    })),
                                  )
                                }
                              />
                              <span className="text-sm font-semibold">Волна {index + 1}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                aria-label="Переместить волну вверх"
                                disabled={index === 0}
                                onClick={() => moveWave(index, -1)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background-soft hover:text-foreground disabled:opacity-30"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                aria-label="Переместить волну вниз"
                                disabled={index === policy.steps.length - 1}
                                onClick={() => moveWave(index, 1)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background-soft hover:text-foreground disabled:opacity-30"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                aria-label="Удалить волну"
                                disabled={policy.steps.length <= 1}
                                onClick={() => removeWave(index)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background-soft hover:text-foreground disabled:opacity-30"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {validationError && (
                            <p className="text-xs leading-5 text-danger" role="alert">
                              {BRACKET_CONSOLIDATION_VALIDATION_LABELS[validationError] ??
                                validationError}
                            </p>
                          )}

                          <div className="border-t border-border/90 pt-3">
                            <ul className="divide-y divide-border/75">
                              {step.actions.map((action, actionIndex) => (
                                <li
                                  key={`action-${index}-${actionIndex}-${action.type}`}
                                  className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                                >
                                  <span className={adminConsolidationActionBadge}>
                                    {formatConsolidationActionLabel(action)}
                                  </span>
                                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                                    {supportsRepeat(action.type) && (
                                      <label className="inline-flex items-center gap-1.5 text-xs text-muted">
                                        <span>{BRACKET_CONSOLIDATION_LABELS.repeatLabel}</span>
                                        <select
                                          className={adminConsolidationSelect}
                                          value={action.repeat ?? 1}
                                          onChange={(event) =>
                                            updateAction(index, actionIndex, {
                                              repeat: Number(event.target.value) as 1 | 2 | 3,
                                            })
                                          }
                                        >
                                          <option value={1}>×1</option>
                                          <option value={2}>×2</option>
                                          <option value={3}>×3</option>
                                        </select>
                                      </label>
                                    )}
                                    {action.type === 'AGE_UP' && (
                                      <label className="inline-flex items-center gap-1.5 text-xs text-muted">
                                        <span>{BRACKET_CONSOLIDATION_LABELS.weightMappingLabel}</span>
                                        <select
                                          className={cn(adminConsolidationSelect, adminConsolidationSelectWide)}
                                          value={action.weightMapping ?? 'SAME_INDEX'}
                                          onChange={(event) =>
                                            updateAction(index, actionIndex, {
                                              weightMapping: event.target
                                                .value as WeightMappingMode,
                                            })
                                          }
                                        >
                                          {Object.entries(
                                            BRACKET_CONSOLIDATION_WEIGHT_MAPPING_LABELS,
                                          ).map(([value, label]) => (
                                            <option key={value} value={value}>
                                              {label}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                    )}
                                  </div>
                                  {step.actions.length > 1 ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      aria-label="Удалить действие"
                                      onClick={() => removeAction(index, actionIndex)}
                                      className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background-soft hover:text-foreground"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  ) : (
                                    <span className="ml-auto h-7 w-7 shrink-0" aria-hidden />
                                  )}
                                </li>
                              ))}
                            </ul>

                            {availableActionTypes.length > 0 && (
                              <div className={cn(adminConsolidationAddAction, 'mt-2.5 border-t border-border/75 pt-2.5')}>
                                <select
                                  className={cn(adminConsolidationSelect, adminConsolidationSelectGrow)}
                                  value={addActionType}
                                  onChange={(event) =>
                                    setAddActionType(event.target.value as ConsolidationStepType)
                                  }
                                >
                                  {availableActionTypes.map((type) => (
                                    <option key={type} value={type}>
                                      {BRACKET_CONSOLIDATION_STEP_LABELS[type] ?? type}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  variant="secondary"
                                  className="h-8 shrink-0 px-3 text-xs whitespace-nowrap"
                                  onClick={() => addActionToWave(index, addActionType)}
                                >
                                  {BRACKET_CONSOLIDATION_LABELS.addAction}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select
                      controlOnly
                      density="compact"
                      className="min-w-0 flex-1"
                      value={addWaveType}
                      onChange={(event) =>
                        setAddWaveType(event.target.value as ConsolidationStepType)
                      }
                    >
                      {ALL_WAVE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {BRACKET_CONSOLIDATION_STEP_LABELS[type] ?? type}
                        </option>
                      ))}
                    </Select>
                    <Button variant="secondary" className="shrink-0" onClick={addWave}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      {BRACKET_CONSOLIDATION_LABELS.addWave}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="text-xs"
                      onClick={() => addPresetWave('experience_weight')}
                    >
                      {BRACKET_CONSOLIDATION_LABELS.presetExperienceWeight}
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-xs"
                      onClick={() => addPresetWave('age_weight')}
                    >
                      {BRACKET_CONSOLIDATION_LABELS.presetAgeWeight}
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-xs"
                      onClick={() => addPresetWave('weight_x2')}
                    >
                      {BRACKET_CONSOLIDATION_LABELS.presetWeightX2}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={`${adminPanel} overflow-hidden`}>
            <div className={cn(adminPanelHeader, 'py-2.5')}>{BRACKET_CONSOLIDATION_LABELS.previewSection}</div>
            <div className="p-3 sm:p-4">
              {!preview ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted">
                  {BRACKET_CONSOLIDATION_LABELS.previewPlaceholder}
                </p>
              ) : (
                <div className="space-y-4">
                  <p
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm font-medium',
                      movedCount > 0
                        ? 'border border-success-border bg-success-soft text-success-foreground'
                        : 'bg-muted/15 text-muted',
                    )}
                  >
                    {movedCount > 0
                      ? BRACKET_CONSOLIDATION_LABELS.movedCount(movedCount)
                      : BRACKET_CONSOLIDATION_LABELS.noMoves}
                  </p>

                  {traceByWave.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {BRACKET_CONSOLIDATION_LABELS.traceTitle}
                      </p>
                      {traceByWave.map(({ stepIndex, actions, hops }) => (
                        <div
                          key={`wave-${stepIndex}`}
                          className="overflow-hidden rounded-lg border border-border"
                        >
                          <div className="border-b border-border bg-muted/15 px-3 py-2 text-sm font-medium">
                            {BRACKET_CONSOLIDATION_LABELS.waveLabel(stepIndex + 1)} ·{' '}
                            {formatConsolidationWaveActions(actions)}
                          </div>
                          <ul className="divide-y divide-border">
                            {hops.map((hop) => (
                              <li
                                key={`${hop.hopIndex}-${hop.fromCategoryKey}-${hop.toCategoryKey}`}
                                className="px-3 py-2.5 text-sm"
                              >
                                <p>
                                  {getCategoryTitleFromKey(hop.fromCategoryKey)} →{' '}
                                  {getCategoryTitleFromKey(hop.toCategoryKey)}{' '}
                                  <span className="text-xs text-muted">({hop.entryIds.length})</span>
                                </p>
                                <ul className="mt-1 space-y-0.5 pl-3 text-xs text-muted">
                                  {hop.entryIds.map((entryId) => {
                                    const entry = entryById.get(entryId)
                                    return (
                                      <li key={entryId} className="truncate">
                                        {entry?.displayName ?? entryId}
                                        {entry?.clubName ? ` · ${entry.clubName}` : ''}
                                        {entry?.city ? ` · ${entry.city}` : ''}
                                      </li>
                                    )
                                  })}
                                </ul>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {skippedRows.length > 0 && (
                    <div className="rounded-lg border border-dashed border-border p-3">
                      <p className="text-sm font-medium">{BRACKET_CONSOLIDATION_LABELS.skippedTitle}</p>
                      <ul className="mt-2 space-y-2 text-xs text-muted">
                        {skippedRows.map((item) => (
                          <li key={item.categoryKey}>
                            <p>{getCategoryTitleFromKey(item.categoryKey)}</p>
                            {item.entryIds.length > 0 && (
                              <ul className="mt-1 space-y-0.5 pl-3">
                                {[...item.entryIds]
                                  .sort((a, b) =>
                                    (entryById.get(a)?.displayName ?? a).localeCompare(
                                      entryById.get(b)?.displayName ?? b,
                                      'ru',
                                    ),
                                  )
                                  .map((entryId) => {
                                    const entry = entryById.get(entryId)
                                    return (
                                      <li key={entryId} className="truncate">
                                        {entry?.displayName ?? entryId}
                                        {entry?.clubName ? ` · ${entry.clubName}` : ''}
                                        {entry?.city ? ` · ${entry.city}` : ''}
                                      </li>
                                    )
                                  })}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {preview && movedCount > 0 && (
            <section className={adminPanel}>
              <div className={adminPanelHeader}>
                {BRACKET_CONSOLIDATION_LABELS.athletesSection}
              </div>
              <div className={adminConsolidationTableWrap}>
                <Table>
                  <thead>
                    <tr>
                      <th>{BRACKET_CONSOLIDATION_LABELS.athleteColumn}</th>
                      <th>{BRACKET_CONSOLIDATION_LABELS.fromColumn}</th>
                      <th>{BRACKET_CONSOLIDATION_LABELS.toColumn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {athleteRows.map(({ placement, entry }) => (
                      <tr key={placement.entryId}>
                        <td>
                          <p className="font-medium">{entry?.displayName ?? placement.entryId}</p>
                          {entry?.clubName ? (
                            <p className="mt-0.5 text-xs text-muted">{entry.clubName}</p>
                          ) : null}
                        </td>
                        <td className="text-muted">
                          {getCategoryTitleFromKey(placement.fromCategoryKey)}
                        </td>
                        <td>{getCategoryTitleFromKey(placement.finalCategoryKey)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </section>
          )}
        </div>
      </div>

      <footer className={adminModalFooter}>
        {error && (
          <p className="mb-2 w-full text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <Button variant="secondary" disabled={busy || loading} onClick={handleClose}>
          {BRACKET_IMPACT_CONFIRM.cancel}
        </Button>
        <Button
          variant={preview && movedCount > 0 ? 'secondary' : 'primary'}
          disabled={busy || loading || !activeWaves || !policyIsValid}
          onClick={runPreview}
        >
          {loading ? BRACKET_IMPACT_CONFIRM.loading : BRACKET_CONSOLIDATION_LABELS.preview}
        </Button>
        {preview && movedCount > 0 && (
          <Button disabled={busy || loading} onClick={runApply}>
            {BRACKET_CONSOLIDATION_LABELS.apply}
          </Button>
        )}
      </footer>
    </Modal>
  )
}
