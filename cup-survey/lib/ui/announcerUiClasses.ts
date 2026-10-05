import { cn } from '@/lib/cn'
import {
  adminBoutsSettingsSegmentTab,
  adminPanel,
  adminSegmentTab,
  adminSettingsPanelBody,
  adminSettingsPanelDesc,
  adminSettingsPanelTitle,
} from '@/lib/ui/adminSurfaceStyles'

export const announcerAdminTabs = 'flex flex-wrap gap-1.5'
export const announcerAdminTab = (active: boolean) => adminSegmentTab(active)

export const announcerPanel = cn(adminPanel, 'overflow-hidden')
export const announcerPanelHeader =
  'flex flex-wrap items-start justify-between gap-3 border-b border-border px-[1.125rem] py-4 sm:px-5'
export const announcerPanelTitle = adminSettingsPanelTitle
export const announcerPanelDesc = adminSettingsPanelDesc
export const announcerPanelBody = adminSettingsPanelBody

export const announcerSectionTitle = 'text-sm font-semibold text-foreground'
export const announcerSectionDesc = 'mt-1 text-[0.8125rem] leading-snug text-muted'

export const announcerPresetRow = 'flex flex-wrap gap-2'
export const announcerPresetBtn = (active: boolean) => adminBoutsSettingsSegmentTab(active)

export const announcerStatusStrip = 'flex flex-wrap items-center gap-2'
export const announcerStatusBadge = cn(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wide',
)
export const announcerStatusOn = 'border-success-border bg-success-soft text-success'
export const announcerStatusOff = 'border-border bg-background-soft text-muted'
export const announcerStatusLive = 'border-accent/30 bg-accent-soft text-accent'
export const announcerStatusPaused = 'border-warning-border bg-warning-soft text-warning-foreground'

export const announcerNowPlayingCard = cn(
  'rounded-xl border border-accent/25 bg-gradient-to-br from-accent-soft/80 via-card to-card px-4 py-4 shadow-sm sm:px-5',
)
export const announcerNowPlayingTitle = 'text-sm font-bold text-foreground'
export const announcerNowPlayingText = 'mt-2 text-sm leading-relaxed text-foreground/90'
export const announcerNowPlayingTimer = 'shrink-0 rounded-full bg-card px-2.5 py-1 text-xs font-semibold tabular-nums text-muted'

export const announcerQueueSectionLabel =
  'mb-2 text-[0.6875rem] font-bold uppercase tracking-wider text-muted'
export const announcerQueueList = 'flex flex-col gap-2'
export const announcerQueueItem = cn(
  'rounded-lg border border-border bg-background-soft/60 px-3 py-3 transition-[border-color,box-shadow] sm:px-4',
  'hover:border-accent/20 hover:shadow-sm',
)
export const announcerQueueItemActive = 'border-accent/35 bg-accent-soft/35 shadow-[0_0_0_1px_rgb(from_var(--color-accent)_r_g_b/0.08)]'
export const announcerQueueItemMeta = 'mt-1 text-xs leading-snug text-muted'
export const announcerQueueItemText = 'mt-1 text-sm leading-snug text-foreground [overflow-wrap:anywhere]'
export const announcerQueueItemActions = 'flex shrink-0 items-center gap-1.5'

export const announcerEventStatusBadge = cn(
  'inline-flex items-center rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide',
)
export const announcerEventStatusReady = 'bg-success-soft text-success'
export const announcerEventStatusPlaying = 'bg-accent-soft text-accent'
export const announcerEventStatusQueued = 'bg-warning-soft text-warning-foreground'
export const announcerEventStatusMuted = 'bg-neutral-soft text-muted'

export const announcerProviderChip = (healthy: boolean) =>
  cn(
    'inline-flex items-center rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold',
    healthy
      ? 'border-success-border bg-success-soft text-success'
      : 'border-border bg-background-soft text-muted',
  )

export const announcerRuleCard = cn(
  'rounded-lg border border-border bg-card shadow-sm transition-[border-color,box-shadow]',
  'cursor-grab active:cursor-grabbing hover:border-accent/20',
)
export const announcerRuleCardDragging = 'border-accent/35 shadow-md'
export const announcerRuleListMeta = 'mt-1 text-xs leading-snug text-muted'
export const announcerRuleListSummary = 'mt-2 flex flex-wrap gap-1.5'
export const announcerRuleToggleGrid = 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3'
export const announcerRuleToggle = cn(
  'flex items-center gap-2.5 rounded-lg border border-border/90 bg-background-soft/70 px-3 py-2 text-sm text-foreground',
  '[&_input]:h-4 [&_input]:w-4 [&_input]:accent-accent',
)

export const announcerHistoryItem =
  'rounded-lg border border-border/90 bg-background-soft/50 px-3 py-2.5 text-sm leading-snug'
export const announcerUploadZone = cn(
  'flex flex-col gap-2 rounded-lg border border-dashed border-border bg-background-soft/50 px-3 py-3',
)

export const announcerWorkspaceGrid =
  'grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start'
