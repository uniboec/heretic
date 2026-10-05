import { cn } from '@/lib/cn'
import { eventCard } from '@/lib/ui/eventSurfaceStyles'
import { adminPanel, adminSegmentTab } from '@/lib/ui/adminSurfaceStyles'

/* ── Public ── */

export const awardsPublicPage = 'space-y-3'
export const awardsPublicTabs = 'inline-flex gap-1 rounded-xl border border-border/70 bg-background-soft/60 p-1'
export const awardsPublicTab = (active: boolean) =>
  cn(
    'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-200',
    active
      ? 'bg-card text-foreground shadow-sm'
      : 'text-muted hover:text-foreground',
  )

export const awardsPublicCategoryCard = cn(
  eventCard,
  'overflow-hidden transition-shadow duration-300 hover:shadow-[0_2px_12px_rgb(15_20_25/0.04)]',
)
export const awardsPublicCategoryHead =
  'space-y-2 border-b border-border/50 px-3.5 py-2.5 sm:px-4'
export const awardsPublicCategoryTitle = 'text-[0.9375rem] font-semibold leading-snug text-foreground'
export const awardsPublicCategoryComment = 'mt-1 text-sm leading-relaxed text-muted'
export const awardsPublicTimeLabel = 'text-[0.6875rem] font-medium uppercase tracking-wider text-muted/80'
export const awardsPublicTimeValue = 'text-[0.9375rem] font-semibold tabular-nums text-foreground'
export const awardsPublicPlacements = 'divide-y divide-border/40'
export const awardsPublicPlacementRow =
  'flex items-center gap-2.5 px-3.5 py-2 transition-colors duration-200 sm:px-4'
export const awardsPublicPlacementName = 'min-w-0 flex-1 text-sm font-medium text-foreground'
export const awardsPublicPlacementClub = 'shrink-0 text-xs text-muted'
export const awardsPublicStatusPill = cn(
  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
)

/* ── Admin ── */

export const awardsAdminTabs = 'flex flex-wrap gap-1'
export const awardsAdminTab = (active: boolean) => adminSegmentTab(active)

export const awardsAdminCategoryCard = cn(adminPanel, 'overflow-hidden')
export const awardsAdminCategoryHead =
  'flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5'
export const awardsAdminCategoryTitle = 'text-sm font-semibold leading-snug text-foreground'
export const awardsAdminCategoryMeta = 'mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted'
export const awardsAdminCategoryActions = 'flex flex-wrap items-center gap-0.5'
export const awardsAdminProgressTrack = 'h-1 w-20 overflow-hidden rounded-full bg-border/60'
export const awardsAdminProgressFill = 'h-full rounded-full bg-accent transition-all duration-500 ease-out'
export const awardsAdminPlacements = 'divide-y divide-border/55'
export const awardsAdminPlacementRow = cn(
  'grid grid-cols-[minmax(0,1fr)_minmax(1.5rem,1fr)_auto] items-center gap-x-2 px-3 py-2.5 sm:px-4',
  'odd:bg-background-soft/30 even:bg-card/50',
  'transition-[background-color,box-shadow] duration-300',
)
export const awardsAdminPlacementIdentity = 'flex min-w-0 items-center gap-2'
export const awardsAdminPlacementMain = 'min-w-0 flex-1'
export const awardsAdminPlacementName = 'text-sm font-medium leading-tight text-foreground'
export const awardsAdminPlacementClub = 'text-xs leading-tight text-muted'
export const awardsAdminPlacementLeader =
  'mx-0.5 h-px min-w-[1.25rem] self-center border-0 border-t border-dotted border-border/80'
export const awardsAdminPlacementActions = 'flex shrink-0 items-center gap-1'
export const awardsAdminIconBtn = cn(
  'inline-flex size-7 items-center justify-center rounded-md border border-transparent text-muted',
  'transition-[color,background-color,border-color,transform] duration-200',
  'hover:border-border/80 hover:bg-background-soft hover:text-foreground active:scale-[0.97]',
  'disabled:pointer-events-none disabled:opacity-40',
)
export const awardsAdminIconBtnActive = 'border-accent/30 bg-accent-soft/80 text-accent'
export const awardsAdminActionBtn = cn(
  'inline-flex size-7 items-center justify-center rounded-md border text-sm',
  'transition-[color,background-color,border-color,transform,box-shadow] duration-200 active:scale-[0.97]',
  'disabled:pointer-events-none disabled:opacity-40',
)
export const awardsAdminActionAward =
  'border-success-border/50 bg-success-soft/50 text-success hover:bg-success-soft hover:shadow-sm'
export const awardsAdminActionSkip =
  'border-border/80 bg-background-soft/80 text-muted hover:border-danger-border/40 hover:bg-danger-soft/40 hover:text-danger-foreground'
export const awardsAdminStatusBadge = cn(
  'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium transition-all duration-300',
)
export const awardsAdminStatusAwarded = 'bg-success-soft/80 text-success'
export const awardsAdminStatusSkipped = 'bg-neutral-soft/80 text-muted'
export const awardsAdminUndoBtn =
  'rounded-md px-1.5 py-0.5 text-xs font-medium text-muted transition-colors hover:bg-background-soft hover:text-foreground'
export const awardsAdminRemainingItem =
  'flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-3 py-2 first:border-t-0'

export function awardsMedalBadge(placement: number) {
  return cn(
    'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-sm',
    placement === 1 && 'bg-amber-50/90 ring-1 ring-amber-200/60',
    placement === 2 && 'bg-slate-100/90 ring-1 ring-slate-200/60',
    placement === 3 && 'bg-orange-50/90 ring-1 ring-orange-200/60',
  )
}

export function awardsPlacementRowAnimation(
  phase: 'idle' | 'glow' | undefined,
  kind?: 'success' | 'skip',
) {
  return cn(
    awardsAdminPlacementRow,
    phase === 'glow' && kind === 'success' && 'animate-ui-resolve-glow bg-success-soft/35',
    phase === 'glow' && kind === 'skip' && 'animate-ui-resolve-glow-muted bg-neutral-soft/50',
  )
}

export function awardsCategoryStatusLabel(status: string): string {
  if (status === 'IN_PROGRESS') return 'Идёт награждение'
  if (status === 'COMPLETED') return 'Завершено'
  return 'В очереди'
}
