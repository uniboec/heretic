'use client'

import { adminPanel, adminPanelHeader, adminCards, adminTableDesktop, adminTableWrap, adminRowCard, adminCardFields, adminCardField, adminSegmentTab, adminBracketsTabs, adminBracketsToolbar, adminBracketsToolbarGroup, adminBracketsToolbarLabel } from '@/lib/ui/adminSurfaceStyles'
import { Button } from '@/components/ui/Button'
import { BRACKET_ACTION_LABELS, BRACKET_TOOLBAR_GROUP_LABELS } from '@/lib/brackets/labels'

interface AdminBracketDraftToolbarProps {
  busy: boolean
  globalCompositionStale: boolean
  controlsEnabled: boolean
  activeCount: number
  publishableCount: number
  publicVisibleCount: number
  boutsReleasedCount: number
  independentBoutsRelease: boolean
  staleRedrawCount: number
  categoryCount: number
  redrawStaleLabel: string
  onSyncAll: () => void
  onSyncCategory: () => void
  onRedrawStale: () => void
  onRedrawAll: () => void
  onReset: () => void
  onBackup: () => void
  onConsolidation: () => void
  onShowAllReady: () => void
  onHideAll: () => void
  onReleaseAllReady?: () => void
  onUnreleaseAll?: () => void
}

export function AdminBracketDraftToolbar({
  busy,
  globalCompositionStale,
  controlsEnabled,
  activeCount,
  publishableCount,
  publicVisibleCount,
  boutsReleasedCount,
  independentBoutsRelease,
  staleRedrawCount,
  categoryCount,
  redrawStaleLabel,
  onSyncAll,
  onSyncCategory,
  onRedrawStale,
  onRedrawAll,
  onReset,
  onBackup,
  onConsolidation,
  onShowAllReady,
  onHideAll,
  onReleaseAllReady,
  onUnreleaseAll,
}: AdminBracketDraftToolbarProps) {
  return (
    <div className={adminBracketsToolbar}>
      <div className={adminBracketsToolbarGroup}>
        <p className={adminBracketsToolbarLabel}>1. {BRACKET_TOOLBAR_GROUP_LABELS.sync}</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={onSyncAll}>
            {BRACKET_ACTION_LABELS.syncAll}
          </Button>
          <Button variant="secondary" disabled={busy || globalCompositionStale} onClick={onSyncCategory}>
            {BRACKET_ACTION_LABELS.syncCategory}
          </Button>
        </div>
      </div>
      <div className={adminBracketsToolbarGroup}>
        <p className={adminBracketsToolbarLabel}>2. {BRACKET_TOOLBAR_GROUP_LABELS.redraw}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy || staleRedrawCount === 0}
            title={
              staleRedrawCount === 0
                ? 'Нет категорий с устаревшей жеребьёвкой или балансом'
                : undefined
            }
            onClick={onRedrawStale}
          >
            {redrawStaleLabel}
          </Button>
          <Button
            variant="secondary"
            disabled={busy || categoryCount === 0}
            title={
              categoryCount === 0 ? 'Нет категорий для жеребьёвки' : undefined
            }
            onClick={onRedrawAll}
          >
            {BRACKET_ACTION_LABELS.redrawAllForce}
          </Button>
        </div>
      </div>
      <div className={adminBracketsToolbarGroup}>
        <p className={adminBracketsToolbarLabel}>3. {BRACKET_TOOLBAR_GROUP_LABELS.visibility}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy || !controlsEnabled || activeCount === 0}
            onClick={onShowAllReady}
          >
            {BRACKET_ACTION_LABELS.showAllReady}
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !controlsEnabled || publicVisibleCount === 0}
            onClick={onHideAll}
          >
            {BRACKET_ACTION_LABELS.hideAll}
          </Button>
        </div>
      </div>
      {independentBoutsRelease && (
        <div className={adminBracketsToolbarGroup}>
          <p className={adminBracketsToolbarLabel}>4. {BRACKET_TOOLBAR_GROUP_LABELS.boutsRelease}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy || !controlsEnabled || publishableCount === 0}
              onClick={onReleaseAllReady}
            >
              {BRACKET_ACTION_LABELS.releaseAllReady}
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !controlsEnabled || boutsReleasedCount === 0}
              onClick={onUnreleaseAll}
            >
              {BRACKET_ACTION_LABELS.unreleaseAll}
            </Button>
          </div>
        </div>
      )}
      <div className={adminBracketsToolbarGroup}>
        <p className={adminBracketsToolbarLabel}>{BRACKET_TOOLBAR_GROUP_LABELS.service}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy || categoryCount === 0}
            onClick={onConsolidation}
          >
            {BRACKET_ACTION_LABELS.consolidation}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onBackup}>
            {BRACKET_ACTION_LABELS.backup}
          </Button>
          <Button variant="secondary" disabled={busy || categoryCount === 0} onClick={onReset}>
            {BRACKET_ACTION_LABELS.resetBrackets}
          </Button>
        </div>
      </div>
    </div>
  )
}
