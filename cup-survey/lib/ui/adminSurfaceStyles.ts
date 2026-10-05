import { cn } from '@/lib/cn'

/** Shell / chrome — class names kept for print CSS in bracket.css */
export const adminShellLayout = 'admin-layout min-h-screen overflow-x-clip'
export const adminShellContainer = 'admin-container mx-auto w-full min-w-0 max-w-6xl px-4 sm:px-6'
export const adminShellMain =
  'admin-container admin-main mx-auto w-full min-w-0 max-w-6xl px-4 py-5 pb-8 has-[.admin-bouts-page]:max-w-[87.5rem] sm:px-6 sm:py-6 sm:pb-10'
export const adminShellHeader =
  'admin-header sticky top-0 z-[var(--z-modal)] max-w-full overflow-x-clip border-b border-border bg-white/92 shadow-sm backdrop-blur-[10px]'
export const adminShellHeaderLink =
  'admin-header-link shrink-0 text-sm font-medium text-muted transition-colors hover:text-accent'

export const adminNav =
  'admin-nav flex max-w-full flex-wrap gap-1 pb-3'
export const adminNavLink =
  'admin-nav-link relative inline-flex min-h-8 items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-semibold leading-tight text-muted transition-colors hover:bg-background-soft hover:text-foreground sm:px-3 sm:text-sm'
export const adminNavLinkActive =
  'admin-nav-link-active bg-accent-soft text-accent after:absolute after:bottom-0.5 after:left-2.5 after:right-2.5 after:h-0.5 after:rounded-full after:bg-accent sm:after:left-3 sm:after:right-3'

export const adminLoginLayout =
  'admin-login-layout flex min-h-screen items-center justify-center px-4 py-6'
export const adminLoginCard =
  'admin-login-card w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-card'

export const adminPageHeader = 'mb-6 flex flex-wrap items-end justify-between gap-4'
export const adminPageTitle =
  'text-2xl font-extrabold tracking-tight text-foreground sm:text-[1.75rem]'
export const adminPageDescription = 'mt-1.5 text-sm leading-normal text-muted'
export const adminPageActions = 'flex flex-wrap gap-2 max-sm:w-full [&_a]:max-sm:flex-1'
export const adminPageActionsBtn = 'max-sm:w-full'

export const adminPanel =
  'admin-panel max-w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm'
export const adminPanelHeader =
  'admin-panel-header border-b border-border px-[1.125rem] py-4 text-sm font-semibold text-foreground'

export const adminStatCard =
  'relative overflow-hidden rounded-xl border border-border bg-card px-[1.125rem] py-4 shadow-sm before:hidden sm:px-5 sm:py-[1.125rem]'
export const adminStatLabel =
  'text-[0.6875rem] font-semibold uppercase tracking-wider text-muted'
export const adminStatValue =
  'mt-1 text-2xl font-extrabold tracking-tight text-foreground'

export const adminCards = 'grid gap-3 p-3 lg:hidden'
export const adminTableDesktop = 'hidden lg:block'
export const adminTableWrap =
  'overflow-x-auto [-webkit-overflow-scrolling:touch] [&_table]:min-w-[40rem]'

export const adminAthletesTableWrap =
  'overflow-x-auto [-webkit-overflow-scrolling:touch] max-w-full [&_table]:min-w-[58rem] [&_td]:align-top [&_th]:align-top'

export const adminRowCard =
  'admin-row-card min-w-0 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:border-accent/25 hover:shadow-md'
export const adminRowCardButton =
  'flex h-auto min-h-0 w-full flex-col items-start justify-start rounded-lg border border-border bg-card p-4 text-left font-normal shadow-sm hover:border-accent/25 hover:bg-card hover:shadow-md'

export const adminCardFields =
  'mt-3 flex flex-col gap-2 border-t border-border/90 pt-3'
export const adminCardField = 'flex flex-col gap-1 text-sm'
export const adminCardFieldLabel =
  'text-[0.6875rem] font-semibold uppercase tracking-wide text-muted'
export const adminCardFieldValue = 'font-medium leading-snug text-foreground'

export const adminCompactActionBtn =
  'min-h-8 justify-center rounded-lg border border-border bg-background-soft px-2 py-1 text-xs font-semibold text-foreground hover:border-border hover:bg-card'
export const adminCompactDangerBtn =
  'min-h-8 justify-center rounded-lg border border-border bg-background-soft px-2 py-1 text-xs font-semibold text-danger-foreground hover:border-danger-border hover:bg-danger-soft'

export function adminFilterPill(active: boolean) {
  return cn(
    'inline-flex min-h-8 items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
    active
      ? 'border-accent bg-accent-soft text-accent'
      : 'border-border bg-background-soft text-muted hover:border-accent hover:text-accent',
  )
}

export function adminSegmentTab(active: boolean) {
  return cn(
    'inline-flex min-h-8 items-center justify-center rounded-full border px-3.5 py-1 text-[0.8125rem] font-semibold transition-colors',
    active
      ? 'border-accent bg-accent-soft text-accent'
      : 'border-border bg-background-soft text-muted hover:border-accent hover:text-accent',
  )
}

export const adminBracketsToolbar =
  'grid gap-4 px-4 pb-4 pt-1 md:grid-cols-3 md:gap-5'
export const adminBracketsToolbarGroup =
  'flex flex-col gap-2 rounded-lg border border-border bg-background-soft p-3'
export const adminBracketsToolbarLabel =
  'text-[0.6875rem] font-bold uppercase tracking-wider text-muted'
export const adminBracketsTabs = 'flex flex-wrap gap-2'

export const adminRowCardSelected =
  'border-accent shadow-[0_0_0_1px_rgb(from_var(--color-accent)_r_g_b/0.15)]'

export const adminStatCardMeta =
  'mt-3 grid gap-2.5 text-[0.8125rem] text-muted [&_dt]:text-[0.6875rem] [&_dt]:font-semibold [&_dt]:uppercase [&_dt]:tracking-wide [&_dd]:m-0 [&_dd]:text-sm [&_dd]:font-medium [&_dd]:text-foreground'

export const adminSettingsPage = 'space-y-6'
export const adminSettingsLayout = 'grid gap-4 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] lg:items-start'
export const adminSettingsPanelBody = 'flex flex-col gap-3.5 px-[1.125rem] pb-[1.125rem] pt-4'
export const adminSettingsPanelTitle = 'm-0 text-sm font-semibold text-foreground'
export const adminSettingsPanelDesc = 'mt-1 text-[0.8125rem] leading-snug text-muted'
export const adminSettingsStagesList = 'grid gap-3 p-3 lg:hidden'
export const adminSettingsStagesTable = 'hidden lg:block'
export const adminSettingsStageFields = 'grid grid-cols-3 gap-3'
export const adminSettingsEmpty = 'm-0 px-4 py-6 text-center text-sm text-muted'
export const adminSettingsPreview = 'px-[1.125rem] pb-5 pt-4'
export const adminSettingsAlert =
  'rounded-lg px-4 py-3.5 text-sm leading-snug'
export const adminSettingsAlertError =
  'border border-danger-border bg-danger-soft text-danger-foreground'
export const adminSettingsAlertSuccess =
  'border border-success-border bg-success-soft text-success-foreground'
export const adminSettingsStageRowCurrent =
  'border-accent/35 shadow-[0_0_0_1px_rgb(from_var(--color-accent)_r_g_b/0.08)]'
export const adminSettingsStageBadge =
  'inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-accent'
export const adminSettingsCheckbox =
  'flex items-start gap-2.5 rounded-lg border border-border/95 bg-card px-3.5 py-3 text-sm leading-snug text-foreground [&_input]:mt-0.5 [&_input]:h-4 [&_input]:w-4 [&_input]:accent-accent'
export const adminSettingsStageTableRowCurrent = '[&_td]:bg-accent/[0.04]'

/** Bouts page */
export const adminBoutsPage = 'admin-bouts-page flex flex-col gap-5 lg:gap-6'
export const adminBoutsStatsGrid = 'grid grid-cols-2 gap-2 sm:grid-cols-4'
export const adminBoutsCompactStatCard = 'px-4 py-3 sm:py-3'
export const adminBoutsCompactStatValue = 'mt-1 text-xl lg:text-[1.375rem]'

export const adminBoutsToolbar =
  'flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border px-4 py-3.5'
export const adminBoutsToolbarRow = 'flex flex-wrap items-center gap-x-3 gap-y-2'
export const adminBoutsToolbarSearch = 'relative min-w-0 flex-[1_1_14rem]'

export const adminBoutsCollapse = 'border-t border-border'
export const adminBoutsCollapseSummary =
  'flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[0.8125rem] font-semibold text-foreground select-none [&::-webkit-details-marker]:hidden'
export const adminBoutsCollapseBody = 'px-4 pb-4'
export const adminBoutsInlineFields = 'flex flex-wrap items-end gap-x-4 gap-y-3'

export const adminBoutsScrollPanel =
  'max-h-[min(24rem,48vh)] overflow-auto overscroll-contain [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-[1] [&_thead_th]:bg-background-soft'
export const adminBoutsScrollPanelCompact = 'max-h-56'
export const adminBoutsScrollPanelLive = 'max-h-[min(22rem,45vh)]'

export const adminBoutsLiveGrid =
  'grid gap-0 xl:grid-cols-2 [&_.admin-bouts-live-mat+.admin-bouts-live-mat]:border-t xl:[&_.admin-bouts-live-mat+.admin-bouts-live-mat]:border-t-0 xl:[&_.admin-bouts-live-mat+.admin-bouts-live-mat]:border-l xl:[&_.admin-bouts-live-mat:nth-child(n+3)]:border-t xl:[&_.admin-bouts-live-mat:only-child]:col-span-full'
export const adminBoutsLiveMat = 'admin-bouts-live-mat min-w-0'
export const adminBoutsLiveMatHead =
  'flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background-soft px-4 py-3.5'

export const adminBoutsScheduleWrap =
  'admin-bouts-schedule-wrap [&_table]:w-full [&_table]:min-w-0 [&_table]:table-fixed sm:[&_table]:min-w-[32rem] lg:[&_table]:min-w-[40rem] [&_tbody_tr]:align-top max-sm:[&_.admin-bouts-schedule-col-time]:hidden max-sm:[&_.admin-bouts-schedule-col-status]:hidden max-sm:[&_td]:px-3 max-sm:[&_td]:py-2.5 max-sm:[&_th]:px-3 max-sm:[&_th]:py-2.5'
export const adminBoutsScheduleColNum = 'admin-bouts-schedule-col-num w-11'
export const adminBoutsScheduleColMat = 'admin-bouts-schedule-col-mat w-14'
export const adminBoutsScheduleColCategory = 'admin-bouts-schedule-col-category w-[28%]'
export const adminBoutsScheduleColParticipants = 'admin-bouts-schedule-col-participants w-[32%]'
export const adminBoutsScheduleColTime =
  'admin-bouts-schedule-col-time w-[10.5rem] max-w-[10.5rem] whitespace-normal text-xs leading-snug'
export const adminBoutsScheduleColStatus = 'admin-bouts-schedule-col-status w-[7.5rem]'

export const adminBoutsCellCategory =
  'truncate text-sm font-semibold leading-snug text-foreground'
export const adminBoutsCellMeta = 'mt-0.5 text-xs leading-snug text-muted [overflow-wrap:anywhere]'
export const adminBoutsRowActions = 'inline-flex items-center justify-end gap-0.5'
export const adminBoutsIconBtn =
  'h-8 w-8 shrink-0 p-0 text-muted hover:text-foreground'
export const adminBoutsParticipantsCell = 'flex min-w-0 flex-col gap-0.5'
export const adminBoutsParticipantRow =
  'm-0 flex min-w-0 items-baseline gap-1.5 text-[0.8125rem] leading-snug'
export const adminBoutsParticipantName =
  'min-w-0 flex-[1_1_auto] truncate font-medium text-foreground'
export const adminBoutsParticipantClub =
  'min-w-0 flex-[0_1_42%] truncate text-[0.6875rem] text-muted'

export const adminBoutsMatRange =
  'mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] leading-snug'
export const adminBoutsMatRangeLabel =
  'text-[0.6875rem] font-semibold uppercase tracking-wide text-muted'
export const adminBoutsMatRangeValue =
  'font-bold tabular-nums text-foreground'
export const adminBoutsMatRangeSep = 'font-semibold text-muted'

export const adminBoutsLiveFootnote =
  'border-t border-border bg-background-soft px-4 py-2.5 text-xs leading-snug text-muted'

export const adminBoutsSettingsBody = 'flex flex-col gap-6 px-[1.125rem] pb-[1.125rem] pt-4'
export const adminBoutsSettingsSection = 'border-t border-border pt-5 first:border-t-0 first:pt-0'
export const adminBoutsSettingsSectionHead =
  'mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'
export const adminBoutsSettingsSectionTitle = 'text-sm font-semibold text-foreground'
export const adminBoutsSettingsFieldGrid =
  'flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end'
export const adminBoutsSettingsSegmentTabs = 'flex flex-wrap gap-2'
export const adminBoutsSettingsSegmentTab = (active: boolean) =>
  cn(
    adminSegmentTab(active),
    'min-h-10 px-4 text-sm',
  )
export const adminBoutsDraftStatus = 'text-xs font-medium text-muted'
export const adminInputWithUnitWrap = 'flex items-center gap-2'
export const adminInputUnitSuffix = 'shrink-0 text-sm tabular-nums text-muted'
export const adminBoutsAdvancedSection = 'space-y-4 border-t border-border pt-5 first:border-t-0 first:pt-0'
export const adminBoutsAdvancedSectionTitle = 'text-sm font-semibold text-foreground'

/** Admin modals */
export const adminModal =
  'flex w-full max-w-lg max-h-[92dvh] flex-col overflow-hidden rounded-t-xl border border-border bg-card shadow-[0_24px_48px_rgb(15_20_25/0.18)] sm:rounded-xl'
export const adminModalWide = 'max-w-[42rem]'
export const adminModalAthlete = 'max-w-[44rem]'
export const adminModalRegistration = 'max-w-[46rem]'
export const adminModalSchedule = 'max-w-[34rem]'
export const adminModalConsolidation =
  'max-w-[52rem] max-h-[min(720px,calc(100dvh-2rem))] [&_.admin-panel]:border-0 [&_.admin-panel]:bg-transparent [&_.admin-panel]:shadow-none [&_.admin-panel-header]:bg-transparent [&_.admin-panel-header]:px-0'

export const adminModalHead =
  'flex shrink-0 items-start justify-between gap-4 px-5 pt-5'
export const adminModalEyebrow =
  'mb-0.5 text-[0.6875rem] font-bold uppercase tracking-wider text-muted'
export const adminModalTitle = 'm-0 text-lg font-extrabold leading-snug text-foreground'
export const adminModalSubtitle = 'mt-1 text-[0.8125rem] text-muted'
export const adminModalClose =
  'inline-flex shrink-0 min-h-11 min-w-11 items-center justify-center rounded-[0.625rem] border-0 bg-transparent text-base text-muted transition-colors hover:bg-background-soft hover:text-foreground'
export const adminModalBody =
  'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4'
export const adminModalFooter =
  'flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-5 pt-3.5 pb-5 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]'
export const adminModalSectionTitle = 'mb-2 text-[0.8125rem] font-bold text-foreground'
export const adminModalErrors =
  'm-0 pl-[1.125rem] text-[0.8125rem] text-danger-foreground'

export const adminFieldLabel =
  'text-[0.6875rem] font-semibold uppercase tracking-wider text-muted'
export const adminInput =
  'w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgb(from_var(--color-accent)_r_g_b/0.12)]'

export function adminBadgeVariant(variant: 'success' | 'warning' | 'danger') {
  return cn(
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5',
    variant === 'success' && 'bg-success-soft text-success-foreground',
    variant === 'warning' && 'bg-warning-soft text-warning-foreground',
    variant === 'danger' && 'bg-danger-soft text-danger-foreground',
  )
}

/** Registration detail modal */
export const adminRegistrationModalBody = 'gap-0 min-h-56 pt-2'
export const adminRegistrationSection = 'border-t border-border py-4 first:border-t-0 first:pt-0'
export const adminRegistrationContacts = 'grid gap-3.5 text-sm sm:grid-cols-2'
export const adminRegistrationProofList = 'm-0 flex flex-col gap-2 p-0 list-none'
export const adminRegistrationProofItem =
  'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background-soft px-4 py-3.5'
export const adminRegistrationAthletes = 'flex flex-col gap-3'
export const adminRegistrationAthleteCard =
  'rounded-lg border border-border bg-background-soft p-4'
export const adminRegistrationEntryList = 'm-0 mt-3 list-none p-0'
export const adminRegistrationEntryItem =
  'mt-3 flex flex-col gap-2 border-t border-[rgb(15_20_25/0.08)] pt-3 first:mt-0 first:border-t-0 first:pt-0'
export const adminRegistrationTotal = 'm-0 text-base font-bold text-foreground [&_strong]:text-accent'
export const adminRegistrationEditLink = 'mt-2'

/** Athlete edit modal */
export const adminAthleteModalBody = 'gap-4 pt-3'
export const adminAthletePanel =
  'rounded-lg border border-border bg-background-soft p-4'
export const adminAthletePanelTitle =
  'mb-3.5 text-sm font-extrabold tracking-wide text-foreground'
export const adminAthletePanelHint =
  '-mt-1 mb-3.5 rounded-[0.625rem] border border-[rgb(from_var(--color-accent)_r_g_b/0.14)] bg-card px-3 py-2.5 text-xs leading-snug text-muted'
export const adminAthleteFormGrid = 'grid gap-3.5 sm:grid-cols-2'
export const adminAthleteModalFooter =
  'items-center justify-between max-sm:flex-col max-sm:items-stretch'
export const adminAthleteModalTotal = 'm-0 text-sm text-muted [&_strong]:font-extrabold [&_strong]:text-foreground'
export const adminAthleteModalActions =
  'flex flex-wrap gap-2 max-sm:w-full max-sm:justify-stretch max-sm:[&_.btn]:flex-1'

/** Edit code panel */
export const adminEditCodePanel = 'border-t border-border py-4'
export const adminEditCodePanelAthlete =
  'mt-1 rounded-lg border border-border bg-neutral-soft/55 p-4'
export const adminEditCodePanelHead =
  'flex flex-wrap items-center justify-between gap-x-3 gap-y-2'
export const adminEditCodePanelLead = 'mt-2 text-[0.8125rem] leading-normal text-muted'
export const adminEditCodePanelForm = 'mt-3.5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end'
export const adminEditCodePanelMessage = 'mt-2.5 text-[0.8125rem] leading-snug'
export const adminEditCodePanelMessageError = 'text-accent'
export const adminEditCodePanelMessageSuccess = 'text-success'

/** Payment proof modal */
export const adminProofPreview =
  'overflow-hidden rounded-lg border border-border bg-neutral-soft'
export const adminProofPreviewMessage =
  'm-0 flex min-h-32 items-center justify-center p-5 text-center text-sm leading-normal text-muted'
export const adminProofPreviewMessageError = 'text-danger-foreground'
export const adminProofImage =
  'block w-full max-h-96 object-contain bg-card'
export const adminProofFrame = 'block min-h-80 w-full border-0 bg-card'
export const adminProofPreviewLink =
  'inline-flex min-h-11 items-center justify-center px-4 py-2.5 text-sm font-semibold text-accent no-underline'
export const adminProofOpenLink =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground no-underline hover:border-accent hover:text-accent'
export const adminProofEntries = 'm-0 list-none p-0'
export const adminProofEntry =
  'flex items-start justify-between gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0'

/** Schedule stage modal */
export const adminScheduleModalBody = 'gap-4'
export const adminScheduleModalErrors =
  'm-0 list-none rounded-lg border border-danger-border bg-danger-soft px-3.5 py-3 text-sm leading-snug text-danger-foreground'

/** Bracket consolidation dialog */
export const adminConsolidationActionBadge =
  'shrink-0 basis-[5.25rem] rounded-[0.4375rem] bg-background-soft px-2 py-1.5 text-center text-[0.8125rem] font-semibold leading-5 whitespace-nowrap'
export const adminConsolidationSelect =
  'w-auto min-w-[3.75rem] max-w-20 rounded-lg border border-border bg-card px-2 py-1.5 pr-7 text-xs leading-5 text-foreground focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgb(from_var(--color-accent)_r_g_b/0.12)]'
export const adminConsolidationSelectWide = 'min-w-[7.5rem] max-w-[10.5rem]'
export const adminConsolidationSelectGrow =
  'w-full min-w-0 max-w-none px-2.5 py-1.5 pr-7 text-[0.8125rem]'
export const adminConsolidationAddAction =
  'grid grid-cols-1 items-center gap-2 min-[521px]:grid-cols-[minmax(0,1fr)_auto]'
export const adminConsolidationTableWrap =
  'max-w-full overflow-x-auto [&_table]:w-full [&_table]:min-w-0 [&_table]:table-fixed [&_td]:align-top [&_td]:[overflow-wrap:anywhere] [&_td]:whitespace-normal [&_th]:align-top [&_th]:[overflow-wrap:anywhere] [&_th]:whitespace-normal [&_td:nth-child(1)]:w-[32%] [&_th:nth-child(1)]:w-[32%] [&_td:nth-child(2)]:w-[34%] [&_td:nth-child(3)]:w-[34%] [&_th:nth-child(2)]:w-[34%] [&_th:nth-child(3)]:w-[34%]'

/** Entry payment status select */
export const adminEntryPaymentControl = 'flex flex-wrap items-center gap-2'
export const adminEntryPaymentControlStacked = 'flex flex-col items-stretch gap-1.5'
export const adminEntryPaymentSelectTable = 'max-w-full text-xs'

export function adminEntryPaymentSelectClass(status: string): string {
  switch (status) {
    case 'PAID':
      return 'border-success-border bg-success-soft/50 text-success-foreground'
    case 'DEBT':
      return 'border-warning-border bg-warning-soft/50 text-warning-foreground'
    case 'ADMITTED_WITHOUT_PAYMENT':
      return 'border-border bg-background-soft text-foreground'
    case 'PAYMENT_REVIEW':
      return 'border-accent/30 bg-accent-soft/40 text-accent'
    default:
      return 'border-border bg-card text-muted'
  }
}
