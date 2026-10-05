'use client'

import { Check, Megaphone, MessageSquare, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { AdminAwardsDashboard } from '@/lib/awards/dto/admin'
import type { AnimatedResolveState } from '@/lib/hooks/useAnimatedResolve'
import {
  awardsAdminActionAward,
  awardsAdminActionBtn,
  awardsAdminActionSkip,
  awardsAdminIconBtn,
  awardsAdminIconBtnActive,
  awardsAdminPlacementActions,
  awardsAdminPlacementClub,
  awardsAdminPlacementIdentity,
  awardsAdminPlacementLeader,
  awardsAdminPlacementMain,
  awardsAdminPlacementName,
  awardsAdminStatusAwarded,
  awardsAdminStatusBadge,
  awardsAdminStatusSkipped,
  awardsAdminUndoBtn,
  awardsMedalBadge,
  awardsPlacementRowAnimation,
} from '@/lib/ui/awardsUiClasses'

type Placement = AdminAwardsDashboard['queue'][number]['placements'][number]

function medalEmoji(placement: number) {
  if (placement === 1) return '🥇'
  if (placement === 2) return '🥈'
  return '🥉'
}

function statusLabel(status: Placement['status']) {
  if (status === 'AWARDED') return 'Вручено'
  if (status === 'NOT_AWARDED') return 'Не вручено'
  return null
}

export function AdminAwardPlacementRow({
  placement,
  animation,
  hasComments,
  onOpenComments,
  onAnnouncerCall,
  onAward,
  onSkip,
  onUndo,
  announcerCallDisabled = false,
}: {
  placement: Placement
  animation?: AnimatedResolveState
  hasComments: boolean
  onOpenComments: () => void
  onAnnouncerCall?: () => void
  onAward: () => void
  onSkip?: () => void
  onUndo?: () => void
  announcerCallDisabled?: boolean
}) {
  const pending = placement.status === 'PENDING'
  const label = statusLabel(placement.status)

  return (
    <li className={cn(awardsPlacementRowAnimation(animation?.phase, animation?.kind))}>
      <div className={awardsAdminPlacementIdentity}>
        <span className={awardsMedalBadge(placement.placement)} aria-hidden>
          {medalEmoji(placement.placement)}
        </span>

        <div className={awardsAdminPlacementMain}>
          <p className={awardsAdminPlacementName}>{placement.displayName}</p>
          <p className={awardsAdminPlacementClub}>{placement.clubName}</p>
        </div>
      </div>

      <div className={awardsAdminPlacementLeader} aria-hidden />

      <div className={awardsAdminPlacementActions} aria-label={`Действия: ${placement.displayName}`}>
        <button
          type="button"
          className={cn(awardsAdminIconBtn, hasComments && awardsAdminIconBtnActive)}
          onClick={onOpenComments}
          aria-label="Комментарии"
          title="Комментарии"
        >
          <MessageSquare className="size-3.5" />
        </button>

        {onAnnouncerCall ? (
          <button
            type="button"
            className={awardsAdminIconBtn}
            onClick={onAnnouncerCall}
            disabled={announcerCallDisabled}
            aria-label="Повторный вызов на награждение"
            title="Повторный вызов на награждение"
          >
            <Megaphone className="size-3.5" />
          </button>
        ) : null}

        {pending ? (
          <>
            <button
              type="button"
              className={cn(awardsAdminActionBtn, awardsAdminActionAward)}
              onClick={onAward}
              aria-label="Медаль вручена"
              title="Медаль вручена"
            >
              <Check className="size-3.5" strokeWidth={2.5} />
            </button>
            {onSkip ? (
              <button
                type="button"
                className={cn(awardsAdminActionBtn, awardsAdminActionSkip)}
                onClick={onSkip}
                aria-label="Медаль не вручена"
                title="Медаль не вручена"
              >
                <X className="size-3.5" strokeWidth={2.5} />
              </button>
            ) : null}
          </>
        ) : (
          <div className="flex items-center gap-1">
            {label ? (
              <span
                className={cn(
                  awardsAdminStatusBadge,
                  placement.status === 'AWARDED' ? awardsAdminStatusAwarded : awardsAdminStatusSkipped,
                )}
              >
                {label}
              </span>
            ) : null}
            {onUndo ? (
              <button type="button" className={awardsAdminUndoBtn} onClick={onUndo} title="Отменить">
                <RotateCcw className="mr-0.5 inline size-3" aria-hidden />
                Отменить
              </button>
            ) : null}
          </div>
        )}
      </div>
    </li>
  )
}
