'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import {
  adminModal,
  adminModalBody,
  adminModalClose,
  adminModalFooter,
  adminModalHead,
  adminModalSubtitle,
  adminModalTitle,
  adminModalWide,
} from '@/lib/ui/adminSurfaceStyles'
import { Select } from '@/components/ui/Select'
import {
  buildAgeDivisionOptionsWithCounts,
  buildDisciplineOptionsWithCounts,
  buildExperienceLevelOptionsWithCounts,
  buildWeightOptionsWithCounts,
  emptyMoveTargetSelection,
  formatMoveTargetOptionLabel,
  getAthleteGenderLabel,
  getMoveTargetSummary,
  isMoveTargetReady,
  patchMoveTargetSelection,
  resolveMoveTargetCategoryKey,
  type MoveTargetSelection,
} from '@/lib/brackets/admin/moveTargetOptions'
import { BRACKET_PARTICIPANT_ACTION_LABELS } from '@/lib/brackets/labels'

interface AdminBracketMoveEntryFormProps {
  open: boolean
  allCategoryKeys: Array<{ key: string; title: string; participantCount: number }>
  athleteGender: 'male' | 'female'
  currentCategoryKey: string
  participantName: string
  busy: boolean
  onTargetChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function AdminBracketMoveEntryForm({
  open,
  allCategoryKeys,
  athleteGender,
  currentCategoryKey,
  participantName,
  busy,
  onTargetChange,
  onConfirm,
  onCancel,
}: AdminBracketMoveEntryFormProps) {
  const [selection, setSelection] = useState<MoveTargetSelection>(() => emptyMoveTargetSelection())

  const disciplineOptions = useMemo(
    () => buildDisciplineOptionsWithCounts(athleteGender, allCategoryKeys),
    [allCategoryKeys, athleteGender],
  )

  const experienceLevelOptions = useMemo(
    () => buildExperienceLevelOptionsWithCounts(selection, athleteGender, allCategoryKeys),
    [allCategoryKeys, athleteGender, selection],
  )

  const ageDivisionOptions = useMemo(
    () => buildAgeDivisionOptionsWithCounts(selection, athleteGender, allCategoryKeys),
    [allCategoryKeys, athleteGender, selection],
  )

  const weightOptions = useMemo(
    () => buildWeightOptionsWithCounts(selection, athleteGender, allCategoryKeys),
    [allCategoryKeys, athleteGender, selection],
  )

  const summary = useMemo(
    () => getMoveTargetSummary(selection, athleteGender, allCategoryKeys, currentCategoryKey),
    [allCategoryKeys, athleteGender, currentCategoryKey, selection],
  )

  const canConfirm = isMoveTargetReady(selection, athleteGender, currentCategoryKey)

  useEffect(() => {
    if (!open) {
      setSelection(emptyMoveTargetSelection())
      return
    }
    onTargetChange('')
  }, [open, onTargetChange])

  useEffect(() => {
    if (!open) return
    onTargetChange(resolveMoveTargetCategoryKey(selection, athleteGender) ?? '')
  }, [athleteGender, onTargetChange, open, selection])

  const patchSelection = (field: keyof MoveTargetSelection, value: string) => {
    setSelection((current) => patchMoveTargetSelection(current, field, value))
  }

  const handleClose = () => {
    if (busy) return
    onCancel()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      panelClassName={cn(adminModal, adminModalWide)}
      ariaLabelledBy="bracket-move-entry-title"
    >
      <header className={adminModalHead}>
        <div className="min-w-0">
          <h2 id="bracket-move-entry-title" className={adminModalTitle}>
            Перенос спортсмена
          </h2>
          <p className={cn(adminModalSubtitle, 'break-words')}>{participantName}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className={adminModalClose}
          aria-label="Закрыть"
          disabled={busy}
          onClick={handleClose}
        >
          Закрыть
        </Button>
      </header>

      <div className={adminModalBody}>
        <p className="mb-4 text-sm text-muted">Пол: {getAthleteGenderLabel(athleteGender)}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Дисциплина</span>
            <Select
              controlOnly
              density="compact"
              className="w-full"
              value={selection.discipline}
              onChange={(event) => patchSelection('discipline', event.target.value)}
            >
              <option value="">Выберите дисциплину</option>
              {disciplineOptions.map((discipline) => (
                <option key={discipline.id} value={discipline.id}>
                  {formatMoveTargetOptionLabel(discipline.label, discipline.count)}
                </option>
              ))}
            </Select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Уровень</span>
            <Select
              controlOnly
              density="compact"
              className="w-full"
              value={selection.experienceLevel}
              disabled={!selection.discipline}
              onChange={(event) => patchSelection('experienceLevel', event.target.value)}
            >
              <option value="">Выберите уровень</option>
              {experienceLevelOptions.map((level) => (
                <option key={level.id} value={level.id}>
                  {formatMoveTargetOptionLabel(level.label, level.count)}
                </option>
              ))}
            </Select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Возраст</span>
            <Select
              controlOnly
              density="compact"
              className="w-full"
              value={selection.ageDivisionId}
              disabled={!selection.experienceLevel}
              onChange={(event) => patchSelection('ageDivisionId', event.target.value)}
            >
              <option value="">Выберите возрастную категорию</option>
              {ageDivisionOptions.map((division) => (
                <option key={division.id} value={division.id}>
                  {formatMoveTargetOptionLabel(division.label, division.count)}
                </option>
              ))}
            </Select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Вес</span>
            <Select
              controlOnly
              density="compact"
              className="w-full"
              value={selection.weightCategoryId}
              disabled={!selection.ageDivisionId}
              onChange={(event) => patchSelection('weightCategoryId', event.target.value)}
            >
              <option value="">Выберите весовую категорию</option>
              {weightOptions.map((weight) => (
                <option key={weight.weightCategoryId} value={weight.weightCategoryId}>
                  {formatMoveTargetOptionLabel(weight.label, weight.count)}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {summary && (
          <div className="mt-4 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
            <p className="font-medium">Выбранная категория:</p>
            <p className="mt-1">Сейчас: {summary.currentCount}</p>
            <p>После переноса: {summary.afterCount}</p>
            {summary.willCreateCategory && (
              <p className="mt-1 text-muted">Категория будет создана</p>
            )}
          </div>
        )}
      </div>

      <footer className={adminModalFooter}>
        <Button variant="secondary" disabled={busy} onClick={handleClose}>
          {BRACKET_PARTICIPANT_ACTION_LABELS.cancel}
        </Button>
        <Button disabled={busy || !canConfirm} onClick={onConfirm}>
          {BRACKET_PARTICIPANT_ACTION_LABELS.confirmMove}
        </Button>
      </footer>
    </Modal>
  )
}
