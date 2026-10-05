'use client'

import { adminPanel, adminPanelHeader, adminRowCard } from '@/lib/ui/adminSurfaceStyles'
import { useMemo, useState } from 'react'
import {
  computeCategoryDrawBalance,
  getParticipantClubConflictHint,
} from '@/lib/brackets/admin/computeDrawBalance'
import { validateSeedPositions } from '@/lib/brackets/core/seeding/validateSeeds'
import { isValidSeedPosition, reorderSeedList, swapSeedPositions } from '@/lib/brackets/participantReorder'
import { BRACKET_PARTICIPANT_ACTION_LABELS } from '@/lib/brackets/labels'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { AdminBracketAuditTrail } from './AdminBracketAuditTrail'
import { AdminBracketStructurePreview } from './AdminBracketStructurePreview'
import { SeedPositionEditor } from './SeedPositionEditor'
import type { CategoryPanelData, CategoryParticipant } from './AdminBracketCategoryPanel'

interface AdminBracketParticipantsSectionProps {
  category: CategoryPanelData
  allCategoryKeys: Array<{ key: string; title: string; participantCount: number }>
  disabled: boolean
  onPatchParticipants: (
    participants: Array<{ entryId: string; seedPosition: number; seedLocked: boolean }>,
  ) => Promise<boolean>
  onToggleLock: (entryId: string, seedLocked: boolean) => Promise<void>
  onMoveEntry: (entryId: string) => void
  onResetPlacement: (entryId: string) => void
  onToast: (message: string, type?: 'error' | 'success') => void
}

export function AdminBracketParticipantsSection({
  category,
  allCategoryKeys,
  disabled,
  onPatchParticipants,
  onToggleLock,
  onMoveEntry,
  onResetPlacement,
  onToast,
}: AdminBracketParticipantsSectionProps) {
  const [openSeedEntryId, setOpenSeedEntryId] = useState<string | null>(null)
  const [dragEntryId, setDragEntryId] = useState<string | null>(null)
  const [dragOverEntryId, setDragOverEntryId] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...category.participants].sort((a, b) => a.seedPosition - b.seedPosition),
    [category.participants],
  )

  const drawBalance = useMemo(() => computeCategoryDrawBalance(sorted), [sorted])
  const categoryTitleMap = useMemo(
    () => new Map(allCategoryKeys.map((item) => [item.key, item.title])),
    [allCategoryKeys],
  )

  const applyParticipants = async (
    next: CategoryParticipant[],
    successMessage?: string,
  ): Promise<boolean> => {
    const seedValidation = validateSeedPositions(
      next.map((participant) => participant.seedPosition),
      next.length,
    )
    if (seedValidation) {
      onToast(
        'Некорректные позиции посева. Синхронизируйте заявки или нажмите «Жеребьёвка».',
        'error',
      )
      return false
    }

    const ok = await onPatchParticipants(
      next.map((participant) => ({
        entryId: participant.entryId,
        seedPosition: participant.seedPosition,
        seedLocked: participant.seedLocked,
      })),
    )
    if (ok && successMessage) {
      onToast(successMessage, 'success')
    }
    return ok
  }

  const swapSeed = async (fromEntryId: string, targetSeedPosition: number): Promise<boolean> => {
    const from = sorted.find((participant) => participant.entryId === fromEntryId)
    if (!from) return false

    if (!isValidSeedPosition(from.seedPosition, sorted.length)) {
      onToast(
        'Некорректная позиция посева. Синхронизируйте заявки или нажмите «Жеребьёвка».',
        'error',
      )
      return false
    }

    if (!isValidSeedPosition(targetSeedPosition, sorted.length)) {
      onToast(`Укажите номер от 1 до ${sorted.length}`, 'error')
      return false
    }

    if (targetSeedPosition === from.seedPosition) return false

    const target = sorted.find((participant) => participant.seedPosition === targetSeedPosition)
    if (!target) {
      onToast('Участник с таким номером не найден', 'error')
      return false
    }

    if (from.seedLocked) {
      onToast('Участник закреплён — смена номера недоступна', 'error')
      return false
    }

    if (target.seedLocked) {
      onToast(`Позиция ${targetSeedPosition} закреплена`, 'error')
      return false
    }

    const swapped = swapSeedPositions(sorted, fromEntryId, targetSeedPosition)
    if (!swapped) return false

    return applyParticipants(
      swapped,
      `${from.displayName} и ${target.displayName} поменялись местами (${from.seedPosition} ↔ ${targetSeedPosition})`,
    )
  }

  const reorderToIndex = async (fromEntryId: string, toIndex: number) => {
    const fromIndex = sorted.findIndex((participant) => participant.entryId === fromEntryId)
    if (fromIndex < 0 || fromIndex === toIndex) return

    const reordered = reorderSeedList(sorted, fromEntryId, toIndex)
    if (!reordered) {
      onToast('Перестановка недоступна — проверьте закреплённые позиции', 'error')
      return
    }

    await applyParticipants(reordered, 'Посев обновлён')
  }

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section className={`${adminPanel} print:hidden`}>
          <div className={adminPanelHeader}>Посев и участники</div>
          <div className="space-y-2 p-3">
            {sorted.length > 0 && (
              <p className="rounded-lg border border-border bg-muted/15 px-3 py-2 text-xs leading-relaxed text-muted">
                Перетащите строку для смены порядка или нажмите номер посева для точного обмена.
                Закреплённые позиции не двигаются.
              </p>
            )}
            {drawBalance?.summary.warnings.length ? (
              <ul className="rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
                {drawBalance.summary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            {sorted.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted">В категории пока нет участников</p>
            ) : (
              <div className="space-y-2 overflow-visible">
                {sorted.map((participant, index) => {
                  const clubConflictHint = getParticipantClubConflictHint(
                    participant,
                    drawBalance,
                    sorted.length,
                  )
                  const isDragging = dragEntryId === participant.entryId
                  const isDropTarget = dragOverEntryId === participant.entryId

                  return (
                    <div
                      key={participant.entryId}
                      data-entry-id={participant.entryId}
                      draggable={!disabled && !participant.seedLocked}
                      onDragStart={() => setDragEntryId(participant.entryId)}
                      onDragEnd={() => {
                        setDragEntryId(null)
                        setDragOverEntryId(null)
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setDragOverEntryId(participant.entryId)
                      }}
                      onDragLeave={() => {
                        if (dragOverEntryId === participant.entryId) {
                          setDragOverEntryId(null)
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        const sourceId = dragEntryId
                        setDragEntryId(null)
                        setDragOverEntryId(null)
                        if (!sourceId || sourceId === participant.entryId) return
                        void reorderToIndex(sourceId, index)
                      }}
                      className={cn(
                        cn(adminRowCard, 'flex items-start gap-2 p-3 transition-shadow'),
                        !disabled && !participant.seedLocked && 'cursor-grab active:cursor-grabbing',
                        (disabled || participant.seedLocked) && 'cursor-default',
                        openSeedEntryId === participant.entryId &&
                          'relative z-10 shadow-[0_0_0_2px_rgb(196_30_42/0.18)]',
                        isDragging && 'opacity-50',
                        isDropTarget && 'ring-2 ring-accent/30',
                      )}
                    >
                      <SeedPositionEditor
                        participant={participant}
                        participants={sorted}
                        clubConflictHint={clubConflictHint}
                        disabled={disabled}
                        onOpenChange={(isOpen) =>
                          setOpenSeedEntryId(isOpen ? participant.entryId : null)
                        }
                        onSwap={swapSeed}
                      />
                      <div className="min-w-0 flex-1 py-0.5">
                        <p className="break-words font-medium leading-snug">{participant.displayName}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {participant.clubName || 'Без клуба'}
                        </p>
                        {clubConflictHint && (
                          <span className="mt-2 inline-flex rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-foreground">
                            {clubConflictHint}
                          </span>
                        )}
                        {participant.isManualMove && (
                          <span className="mt-2 inline-flex rounded-full bg-info-soft px-2 py-0.5 text-xs font-medium text-info-foreground">
                            Перенесён вручную
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end justify-start gap-1 self-center sm:self-start">
                        <Button
                          type="button"
                          variant="ghost"
                          className="cursor-pointer text-xs font-medium text-muted hover:text-foreground"
                          onClick={() => void onToggleLock(participant.entryId, participant.seedLocked)}
                        >
                          {participant.seedLocked
                            ? BRACKET_PARTICIPANT_ACTION_LABELS.unlock
                            : BRACKET_PARTICIPANT_ACTION_LABELS.lock}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="cursor-pointer text-xs font-medium text-muted hover:text-foreground"
                          onClick={() => onMoveEntry(participant.entryId)}
                        >
                          {BRACKET_PARTICIPANT_ACTION_LABELS.move}
                        </Button>
                        {participant.isManualMove && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="cursor-pointer text-xs font-medium text-muted hover:text-foreground"
                            onClick={() => void onResetPlacement(participant.entryId)}
                          >
                            {BRACKET_PARTICIPANT_ACTION_LABELS.resetPlacement}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <AdminBracketStructurePreview category={category} onToast={onToast} />
      </div>

      {sorted.some((participant) => participant.isManualMove) && (
        <section className={`${adminPanel} print:hidden`}>
          <div className={adminPanelHeader}>История переносов</div>
          <div className="space-y-2 p-3">
            {sorted
              .filter((participant) => participant.isManualMove)
              .map((participant) => (
                <AdminBracketAuditTrail
                  key={participant.entryId}
                  entryId={participant.entryId}
                  categoryTitleMap={categoryTitleMap}
                />
              ))}
          </div>
        </section>
      )}
    </>
  )
}
