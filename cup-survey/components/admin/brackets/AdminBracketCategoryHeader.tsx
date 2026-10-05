'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { boutsRepairRequiredMessage } from '@/lib/bouts/repairRequired'
import {
  categoryEligibleForAwardsSchedule,
  categoryRequiresBouts,
} from '@/lib/brackets/core/categoryRequiresBouts'
import { BRACKET_ACTION_LABELS } from '@/lib/brackets/labels'
import {
  formatBronzeModeLabel,
  formatCategoryStatusLabel,
  formatParticipantCount,
  formatStatusReasonLabel,
  formatSystemLabel,
} from './bracketAdminUtils'
import type { CategoryPanelData } from './AdminBracketCategoryPanel'
import { cn } from '@/lib/cn'
import { semanticChipClasses } from '@/lib/ui/semanticSurfaceStyles'

function StatusBadge({
  children,
  tone,
}: {
  children: ReactNode
  tone: 'amber' | 'violet' | 'sky' | 'neutral'
}) {
  const toneClass =
    tone === 'neutral' ? 'bg-muted/30 text-muted border-border' : semanticChipClasses[tone]

  return (
    <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', toneClass)}>
      {children}
    </span>
  )
}

interface AdminBracketCategoryHeaderProps {
  category: CategoryPanelData
  busy: boolean
  globalCompositionStale: boolean
  controlsEnabled: boolean
  independentBoutsRelease?: boolean
  matCount: number
  onRedraw: () => void
  onShowOnSite: () => void
  onHideFromSite: () => void
  onReleaseToSchedule?: () => void
  onUnreleaseFromSchedule?: () => void
  onForceRebuild?: () => void
}

export function AdminBracketCategoryHeader({
  category,
  busy,
  globalCompositionStale,
  controlsEnabled,
  independentBoutsRelease = false,
  matCount,
  onRedraw,
  onShowOnSite,
  onHideFromSite,
  onReleaseToSchedule,
  onUnreleaseFromSchedule,
  onForceRebuild,
}: AdminBracketCategoryHeaderProps) {
  const categoryScheduleInput = {
    status: category.status,
    autoSystemId: category.autoSystemId,
    systemOverride: category.systemOverride,
    participantCount: category.participants.length,
  }
  const requiresBouts = categoryRequiresBouts(categoryScheduleInput)
  const eligibleForAwardsSchedule = categoryEligibleForAwardsSchedule(categoryScheduleInput)
  const canReleaseToSchedule = (requiresBouts || eligibleForAwardsSchedule) && !category.boutsReleased

  return (
    <div className="space-y-3 border-b border-border pb-4">
      <div className="min-w-0 space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{category.title}</h2>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="neutral">{formatCategoryStatusLabel(category.status)}</StatusBadge>
          {category.effectiveSystemId && (
            <StatusBadge tone="neutral">{formatSystemLabel(category.effectiveSystemId)}</StatusBadge>
          )}
          {category.effectiveBronzeMode && (
            <StatusBadge tone="neutral">
              {formatBronzeModeLabel(category.effectiveBronzeMode)}
            </StatusBadge>
          )}
          <StatusBadge tone="neutral">
            {formatParticipantCount(category.participants.length)}
          </StatusBadge>
          {category.publicVisible && <StatusBadge tone="sky">На сайте</StatusBadge>}
          {category.boutsReleased && <StatusBadge tone="sky">В расписании</StatusBadge>}
          {category.boutsRepairRequired && (
            <StatusBadge tone="amber">
              <span
                title={boutsRepairRequiredMessage(category.matIndex, matCount)}
                className="cursor-help"
              >
                Нужна настройка ковра
              </span>
            </StatusBadge>
          )}
        </div>
        {category.statusReason && (
          <p className="text-sm text-warning-foreground">{formatStatusReasonLabel(category.statusReason)}</p>
        )}
        {category.formatRuleLabel && !category.systemOverride && (
          <p className="text-sm text-muted">По правилам: {category.formatRuleLabel}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {category.seedingStale && <StatusBadge tone="violet">Жеребьёвка устарела</StatusBadge>}
          {category.balanceStale && <StatusBadge tone="violet">Баланс устарел</StatusBadge>}
          {category.compositionStale && !globalCompositionStale && (
            <StatusBadge tone="amber">Состав устарел</StatusBadge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={onRedraw}>
          {BRACKET_ACTION_LABELS.redrawCategory}
        </Button>
        {onForceRebuild && (
          <Button
            variant="secondary"
            disabled={
              busy ||
              !controlsEnabled ||
              category.status !== 'ACTIVE' ||
              (!category.compositionStale &&
                !category.seedingStale &&
                !category.balanceStale)
            }
            onClick={onForceRebuild}
          >
            {BRACKET_ACTION_LABELS.forceRebuild}
          </Button>
        )}
        <Button
          disabled={
            busy ||
            !controlsEnabled ||
            globalCompositionStale ||
            category.status !== 'ACTIVE' ||
            category.compositionStale ||
            category.seedingStale ||
            category.balanceStale ||
            category.publicVisible
          }
          onClick={onShowOnSite}
        >
          {BRACKET_ACTION_LABELS.showCategoryOnSite}
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !controlsEnabled || !category.publicVisible}
          onClick={onHideFromSite}
        >
          {BRACKET_ACTION_LABELS.hideCategoryFromSite}
        </Button>
        {independentBoutsRelease && onReleaseToSchedule && onUnreleaseFromSchedule && (
          <>
            <Button
              variant="secondary"
              disabled={
                busy ||
                !controlsEnabled ||
                !canReleaseToSchedule ||
                globalCompositionStale ||
                category.status !== 'ACTIVE' ||
                category.compositionStale ||
                category.seedingStale ||
                category.balanceStale
              }
              title={
                eligibleForAwardsSchedule
                  ? 'Категория с одним участником попадёт в расписание награждения'
                  : undefined
              }
              onClick={onReleaseToSchedule}
            >
              {BRACKET_ACTION_LABELS.releaseCategory}
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !controlsEnabled || !category.boutsReleased}
              onClick={onUnreleaseFromSchedule}
            >
              {BRACKET_ACTION_LABELS.unreleaseCategory}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
