/** Sports Control Deck — layout class map (colors via judgeTokens + CSS vars) */

export { judgeTokens } from './tokens/judgeTokens'



export const judgeStyles = {

  root: 'judge-console min-h-dvh max-h-dvh flex flex-col bg-background text-foreground',

  main: 'flex min-h-0 flex-1 flex-col overflow-hidden',

  workScroll: 'min-h-0 flex-1 overflow-y-auto px-3 py-3 lg:px-4 lg:py-4',

  workArea: 'mx-auto w-full max-w-[1760px] space-y-3',

  landscapeGate:
    'flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center',

  serviceBar: 'shrink-0 border-b border-border bg-card px-4 py-2.5 shadow-card',

  boutNavBtn:
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-surface active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40',

  grid3: 'grid items-start gap-3 lg:grid-cols-[minmax(0,41fr)_18fr_minmax(0,41fr)]',

  grid3Scoring: 'grid items-start gap-3 lg:grid-cols-[minmax(0,41fr)_18fr_minmax(0,41fr)]',

  grid3Decision: 'grid items-start gap-3 lg:grid-cols-[minmax(0,34fr)_32fr_minmax(0,34fr)]',



  cornerPanel:
    'relative overflow-hidden rounded-card border border-border bg-card shadow-card',

  cornerPanelCorrection:
    'relative overflow-hidden rounded-card border-2 border-warning/50 bg-card shadow-card',

  cornerAccentTopRed: 'absolute inset-x-0 top-0 h-1.5 bg-[#E5484D]',

  cornerAccentTopBlue: 'absolute inset-x-0 top-0 h-1.5 bg-[#3478F6]',

  cornerAccentLeftRed: 'absolute inset-y-0 left-0 w-1 bg-[#E5484D]',

  cornerAccentLeftBlue: 'absolute inset-y-0 left-0 w-1 bg-[#3478F6]',

  cornerHeaderRed: 'border-b border-[#D6DCE5] bg-[#FFF5F5] px-3 py-2 pl-4',

  cornerHeaderBlue: 'border-b border-[#D6DCE5] bg-[#F5F8FF] px-3 py-2 pl-4',

  cornerBody: 'px-3 py-2.5 pl-4',



  cornerBadgeRed:

    'rounded-[5px] bg-[#E5484D] px-1 py-px text-[9px] font-bold uppercase tracking-[0.05em] text-white',

  cornerBadgeBlue:

    'rounded-[5px] bg-[#3478F6] px-1 py-px text-[9px] font-bold uppercase tracking-[0.05em] text-white',

  cornerOverflowBtn:

    'rounded px-1 py-0.5 text-base leading-none text-[#D6DCE5] transition-colors hover:text-[#98A2B3] disabled:opacity-40',



  cornerAthleteRow: 'mt-1 flex items-start gap-2',

  cornerAthleteIdentity: 'min-w-0 flex-1',

  cornerDisciplinarySlot:
    'flex h-7 w-[3rem] shrink-0 items-center justify-end self-start pt-0.5',

  athleteName:
    'text-[17px] font-semibold leading-snug tracking-normal text-[#101828] [text-wrap:balance]',

  athleteClub: 'mt-0.5 text-xs leading-snug text-[#667085] line-clamp-2',

  disciplinaryCardsRow: 'flex items-center justify-end gap-0.5',

  disciplinaryCard:
    'inline-block h-7 w-5 shrink-0 rounded-[3px] shadow-[0_2px_0_rgba(16,24,40,0.18)] ring-1 ring-black/15',

  disciplinaryCardYellow: 'bg-[#F5C518]',

  disciplinaryCardRed: 'bg-[#E5484D]',

  disciplinaryCardStacked: '-ml-1.5 rotate-6',



  score: 'text-[5.5rem] font-[750] tabular-nums leading-none tracking-[-0.045em] sm:text-[6rem]',

  scoreFlash: 'judge-score-flash',



  scoreKey:
    'judge-score-key flex h-14 min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center rounded-lg border-2 border-border bg-card text-2xl font-bold tabular-nums text-foreground shadow-[0_3px_0_var(--color-border)] transition-all hover:border-muted active:translate-y-[3px] active:border-muted active:bg-surface active:shadow-none disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted disabled:opacity-55 disabled:shadow-none',

  scoreKeyFlash: 'judge-score-key-flash',

  scoreKeyHint: 'mt-0.5 text-[10px] font-normal text-[#98A2B3]',

  scoreColumn: 'flex min-w-0 flex-col gap-1.5',

  technicalActionRow: 'flex min-w-0 items-stretch gap-1',

  technicalActionKey:
    'flex min-h-10 min-w-0 flex-1 basis-0 items-center justify-center rounded-md border border-[#D6DCE5] bg-[#F7F8FA] px-1 py-1.5 text-[10px] font-bold leading-tight tracking-[0.01em] text-[#475467] transition-all hover:border-[#C5CDD6] hover:bg-white active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50',

  technicalActionKeyFlash: 'judge-technical-action-flash',



  btnPenalty:

    'group flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-[#D6DCE5] px-3 py-2.5 text-left transition-all hover:border-[#C5CDD6] active:translate-y-px disabled:cursor-not-allowed disabled:border-[#E5E9EF] disabled:bg-[#F2F4F7] disabled:opacity-60',

  btnPenaltyTintRed: 'bg-[#FFF5F5] hover:bg-[#FEECEC]',

  btnPenaltyTintBlue: 'bg-[#F5F8FF] hover:bg-[#E8F0FF]',

  btnPenaltyDq: 'judge-dq-pulse border-[#D97706]/50 bg-[#FFF8E8] hover:bg-[#FFF3D6]',

  btnPenaltyBody: 'flex min-w-0 flex-1 flex-col gap-[2px] py-0.5',

  btnPenaltyTitle: 'block whitespace-normal text-[16px] font-semibold leading-[1.15] text-[#101828]',

  btnPenaltyTitleDq: 'block whitespace-normal text-[15px] font-bold leading-[1.2] text-[#92400E]',

  btnPenaltyPreview: 'block whitespace-normal text-[12px] font-normal leading-[1.3] text-[#98A2B3]',

  btnPenaltyPreviewDq: 'block whitespace-normal text-[12px] font-normal leading-[1.35] text-[#92400E]/70',

  btnPenaltyChevron: 'shrink-0 self-center text-xl font-light leading-none text-[#98A2B3] group-hover:text-[#667085]',

  cornerActionGrid: 'grid grid-cols-3 gap-1.5',

  btnPenaltyCompact:
    'group flex min-h-[48px] min-w-0 flex-col items-center justify-center rounded-lg border border-[#D6DCE5] px-2 py-2 text-center transition-all hover:border-[#C5CDD6] active:translate-y-px disabled:cursor-not-allowed disabled:border-[#E5E9EF] disabled:bg-[#F2F4F7] disabled:opacity-60',

  btnPenaltyTitleCompact:
    'block text-[14px] font-semibold leading-[1.15] text-[#101828] line-clamp-2',

  btnPenaltyTitleDqCompact: 'block text-[14px] font-bold leading-[1.15] text-[#92400E] line-clamp-2',

  btnPenaltyPreviewCompact:
    'block text-[12px] font-normal leading-[1.25] text-[#98A2B3] line-clamp-2',

  btnPenaltyPreviewDqCompact:
    'block text-[12px] font-normal leading-[1.25] text-[#92400E]/70 line-clamp-2',

  btnPassivity:

    'flex min-h-12 w-full flex-col items-start justify-center gap-[3px] rounded-lg border border-[#D6DCE5] bg-white px-3 py-2 text-left transition-all hover:border-[#C5CDD6] hover:bg-[#FAFBFC] active:translate-y-px disabled:border-[#E5E9EF] disabled:bg-[#F2F4F7] disabled:opacity-60',

  btnPassivityCompact:
    'flex min-h-[48px] min-w-0 flex-col items-center justify-center rounded-lg border border-[#D6DCE5] bg-white px-2 py-2 text-center transition-all hover:border-[#C5CDD6] hover:bg-[#FAFBFC] active:translate-y-px disabled:border-[#E5E9EF] disabled:bg-[#F2F4F7] disabled:opacity-60',

  btnPassivityActive: 'border-[#D97706]/40 bg-[#FFF8E8] hover:bg-[#FFF3D6]',

  btnPassivityTitle: 'block text-[16px] font-semibold leading-[1.15] text-[#101828]',

  btnPassivityTitleActive: 'block text-[16px] font-semibold leading-[1.15] text-[#92400E]',

  btnPassivityPreview: 'block text-[12px] font-normal leading-[1.3] text-[#98A2B3]',

  btnPassivityTitleCompact: 'block text-[14px] font-semibold leading-[1.15] text-[#101828] line-clamp-2',

  btnPassivityTitleActiveCompact: 'block text-[14px] font-semibold leading-[1.15] text-[#92400E] line-clamp-2',

  btnPassivityPreviewCompact: 'block text-[12px] font-normal leading-[1.25] text-[#98A2B3] line-clamp-2',

  btnCornerAux:
    'flex min-h-[48px] min-w-0 flex-col items-center justify-center rounded-lg border px-2 py-2 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50',

  btnCornerAuxTitle: 'block text-[14px] font-semibold leading-[1.15] line-clamp-2',

  btnCornerAuxTitleActive: 'block text-[14px] font-semibold leading-[1.15] line-clamp-2',

  btnCornerAuxMeta: 'block text-[12px] font-normal leading-[1.25] text-[#98A2B3] line-clamp-2',

  btnCornerAuxOverLimit: 'border-[#F04438]/45',

  btnCornerAuxTitleOverLimit: 'text-[#B42318]',

  btnCornerAuxOvertime: 'font-bold text-[#B42318]',

  cornerFollowUpRow: 'flex flex-wrap gap-1.5',

  cornerFollowUpBtn:
    'min-h-10 min-w-0 flex-1 rounded-lg border border-[#D6DCE5] bg-white px-2 py-2 text-center text-[13px] font-semibold leading-tight text-[#101828] transition-colors hover:bg-[#FAFBFC] disabled:cursor-not-allowed disabled:opacity-50',

  btnAthleteWait:
    'flex min-h-[52px] w-full flex-col items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-center transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50',

  btnAthleteWaitCompact: 'border-border bg-background hover:bg-muted/40',

  btnAthleteWaitActive: 'border-[#7C3AED]/40 bg-[#F5F3FF] hover:bg-[#EDE9FE]',

  btnAthleteDoctor:
    'flex min-h-[52px] w-full flex-col items-center justify-center rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-center transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50',

  btnAthleteDoctorCompact: 'border-sky-300 bg-sky-50 hover:bg-sky-100',

  btnAthleteDoctorActive: 'border-sky-500/50 bg-sky-100 hover:bg-sky-100',

  btnAthleteEquipment:
    'flex min-h-[52px] w-full flex-col items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-center transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50',

  btnAthleteEquipmentCompact: 'border-amber-300 bg-amber-50 hover:bg-amber-100',

  btnAthleteEquipmentActive: 'border-amber-500/50 bg-amber-100 hover:bg-amber-100',



  toolbarBtn:

    'inline-flex h-8 items-center rounded-lg border border-[#D6DCE5] bg-[#EEF1F5] px-2.5 text-xs font-semibold text-[#374151] transition-colors hover:bg-[#E2E7ED] active:bg-[#D6DCE5] disabled:opacity-50',

  btnServiceAction:
    'inline-flex h-[52px] min-h-[52px] min-w-[9.5rem] items-center justify-center gap-2 rounded-lg border-2 border-border bg-card px-3.5 text-[13px] font-semibold text-foreground transition-all hover:border-muted hover:bg-surface active:translate-y-px disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted disabled:opacity-55',

  btnServiceActionIcon: 'text-base leading-none text-[#667085]',

  btnServiceActionActive:

    'border-[#D97706]/45 bg-[#FFF8E8] text-[#92400E] [&>span:first-child]:text-[#D97706]',

  btnFinishOutline:

    'inline-flex h-11 items-center rounded-lg border-2 border-[#101828] bg-white px-4 text-[13px] font-semibold text-[#101828] shadow-[inset_3px_0_0_#D97706] transition-all hover:border-[#374151] hover:bg-[#FAFBFC] active:translate-y-px disabled:opacity-45',

  btnFinishClock:

    'flex h-10 w-full items-center justify-center rounded-md border border-white/25 bg-transparent px-3 text-[12px] font-semibold text-white/90 transition-colors hover:border-white/40 hover:bg-white/10 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40',

  btnUndo:

    'inline-flex h-8 shrink-0 items-center rounded-lg border border-[#D6DCE5] bg-white px-3 text-[11px] font-bold uppercase tracking-[0.03em] text-[#374151] transition-all hover:border-[#C5CDD6] hover:bg-[#FAFBFC] active:translate-y-px disabled:opacity-45',

  btnActionBar: 'flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC] px-4 py-3',



  btnFight:

    'flex h-[60px] w-full flex-col items-center justify-center gap-0.5 rounded-md border-2 text-white transition-all active:translate-y-[2px] disabled:opacity-40',

  btnFightStart:

    'border-[#0D5C3D] bg-[#18A66A] shadow-[0_3px_0_#0D5C3D] hover:bg-[#148A5C] active:border-[#0A4A31] active:bg-[#0F6B47] active:shadow-none',

  btnFightStop:

    'border-[#1F2937] bg-[#374151] shadow-[0_3px_0_#1F2937] hover:bg-[#1F2937] active:border-[#111827] active:bg-[#1F2937] active:shadow-none',

  btnFightTitle: 'text-[19px] font-bold uppercase leading-none tracking-[0.06em]',

  btnFightSub: 'text-[12px] font-normal normal-case leading-none tracking-normal opacity-90',



  clockModule:
    'flex w-full flex-col rounded-card border border-white/10 bg-[var(--judge-control-dark)] px-2.5 py-2 text-center lg:sticky lg:top-4',

  clockModuleRunning: 'ring-2 ring-[var(--judge-fight-active)] ring-offset-2 ring-offset-[var(--judge-control-dark)]',

  clockModuleWarning: 'judge-clock-warning-pulse border-2',

  actionBarZone: 'shrink-0 border-t border-border bg-surface',

  historyLabel: 'text-[11px] font-bold uppercase tracking-[0.06em] text-muted',

  historyDotRed: 'bg-[var(--judge-corner-red)]',

  historyDotBlue: 'bg-[var(--judge-corner-blue)]',

  clockStack: 'flex flex-col items-center gap-0.5 leading-none py-1',

  clockFooter:

    'mt-1.5 border-t border-white/10 pt-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-[#64748B]',

  clock: 'text-[4.75rem] font-mono font-bold tabular-nums leading-none tracking-[-0.02em] text-white sm:text-[5.25rem]',

  clockMeta: 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]',



  statusChip:

    'inline-flex items-center gap-1.5 rounded-[6px] px-2 py-0.5 text-[11px] font-semibold tracking-[0.02em]',

  statusChipLive: 'bg-emerald-500/15 text-emerald-700',

  statusChipPaused: 'bg-amber-500/15 text-amber-800',

  statusChipOffline: 'bg-red-500/15 text-red-700',

  statusChipLease: 'bg-blue-500/15 text-blue-800',

  statusChipDarkLive: 'bg-emerald-500/20 text-emerald-300',

  statusChipDarkPaused: 'bg-amber-500/20 text-amber-300',

  statusChipDarkIdle: 'bg-white/10 text-[#94A3B8]',

  statusDotOnline: 'h-1.5 w-1.5 rounded-full bg-[#18A66A]',

  statusDotLease: 'h-1.5 w-1.5 rounded-full bg-[#3478F6]',

  statusDotOffline: 'h-1.5 w-1.5 rounded-full bg-[#E5484D]',

  statusDotBusy: 'h-1.5 w-1.5 rounded-full bg-[#D97706]',



  stripDivider: 'border-t border-[#D6DCE5]',

  historyStrip: 'bg-[#FAFBFC] px-4 py-3',

  queueStrip: 'flex items-center gap-3 bg-[#F8FAFC] px-4 py-2.5',

  section: 'rounded-[10px] bg-white px-4 py-3',



  cornerScoreRow: 'grid grid-cols-[minmax(0,1fr)_9.75rem] items-stretch gap-x-1.5',

  cornerScoreColumn: 'flex min-w-0 flex-col',

  cornerPenaltyInScore: 'mt-2',

  cornerOutcomeColumn: 'flex min-w-0 flex-col self-stretch',

  cornerOutcomeDock: 'flex flex-col gap-1.5',

  cornerOutcomeCard:
    'rounded-md border border-[#D97706]/40 bg-[#FFF8E8]/95 px-2 py-1.5 shadow-sm',

  cornerOutcomeText: 'text-[10px] font-medium leading-snug text-[#92400E]',

  cornerOutcomeBtn:
    'mt-1 flex min-h-[30px] w-full items-center justify-center rounded-md border border-[#D97706]/55 bg-white px-1.5 text-[10px] font-semibold leading-tight text-[#92400E] transition-all hover:border-[#D97706] hover:bg-[#FFF3D6] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45',

  ladderSection: 'space-y-2',

  ladderRail: 'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1',

  ladderRailLabel:

    'shrink-0 text-[10px] font-bold uppercase tracking-[0.06em] text-[#667085]',

  ladderRailSteps: 'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5',

  ladderRailStep: 'inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums',

  ladderRailStepDone: 'text-[#101828]',

  ladderRailStepNext: 'rounded px-1 py-px text-[#92400E] ring-1 ring-[#D97706]',

  ladderRailStepFuture: 'text-[#B8BFC8]',



  historyLogRow: 'flex min-w-0 items-center gap-3 font-mono text-[12px] leading-tight',

  historyLogTime: 'w-[4.75rem] shrink-0 tabular-nums text-[#667085]',

  historyLogCorner: 'flex w-[5.5rem] shrink-0 items-center gap-1.5 uppercase tracking-wide',

  historyLogCornerDot: 'inline-block h-1.5 w-1.5 shrink-0 rounded-full',

  historyLogAction: 'min-w-0 flex-1 truncate font-sans text-[13px] font-medium text-[#374151]',

  historyLogActionMuted: 'text-[#98A2B3]',

  historyLogActionStrong: 'font-semibold text-[#101828]',



  timelineRow: 'mt-2.5 flex h-[6rem] min-w-0 items-center gap-3',

  timelineScrollViewport:
    'flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#E8ECF1] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',

  timelineScroll:
    'min-h-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#D6DCE5] [&::-webkit-scrollbar-track]:bg-[#F8FAFC]',

  timelineScrollTrack: 'inline-flex items-start px-2.5 pb-3 pt-2',

  timelineConnector:
    'mx-1 h-px w-3 shrink-0 bg-gradient-to-r from-[#D6DCE5] via-[#C5CDD6] to-[#D6DCE5]',

  timelineChip:
    'flex w-[4.75rem] shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-1',

  timelineChipEnter: 'judge-timeline-chip-enter',

  timelineChipRed: 'bg-[#FFF7F7]/80',

  timelineChipBlue: 'bg-[#F5F8FF]/80',

  timelineChipLatest: 'bg-[#FFF8E8]/90 ring-1 ring-[#D97706]/25',

  timelineHeadline:
    'flex h-10 w-10 items-center justify-center rounded-[9px] text-[18px] font-bold tabular-nums leading-none shadow-[0_2px_0_rgba(16,24,40,0.12)]',

  timelineHeadlineCompact: 'text-[13px] tracking-[-0.02em]',

  timelineHeadlineRed: 'bg-[#E5484D] text-white',

  timelineHeadlineBlue: 'bg-[#3478F6] text-white',

  timelineHeadlinePenaltyRed:
    'border-2 border-[#E5484D] bg-[#FFF5F5] text-[#B42318] text-[14px]',

  timelineHeadlinePenaltyBlue:
    'border-2 border-[#3478F6] bg-[#F5F8FF] text-[#175CD3] text-[14px]',

  timelineHeadlineNeutral:
    'border border-[#D6DCE5] bg-[#F7F8FA] text-[#475467] text-[13px]',

  timelineHeadlineLatest: 'ring-2 ring-[#D97706]/40 ring-offset-1 ring-offset-white',

  timelineSubtitle:
    'max-w-[4.5rem] truncate text-center text-[11px] font-medium leading-tight text-[#344054]',

  timelineBoutTime: 'text-[10px] font-medium tabular-nums leading-none text-[#98A2B3]',

  timelineEmpty: 'mt-2.5 rounded-lg border border-dashed border-[#D6DCE5] bg-white px-3 py-4 text-center text-xs text-[#98A2B3]',



  correctionBanner:
    'rounded-lg border border-[#F5D0A0] bg-[#FFF8E8] px-4 py-3 text-[#92400E] shadow-card',
  correctionBannerTitle: 'text-sm font-bold leading-snug',
  correctionBannerSubtitle: 'mt-0.5 text-[13px] font-medium leading-snug text-[#B45309]',

  correctionCenterSlot: 'flex min-h-[12rem] items-center justify-center px-2 lg:sticky lg:top-4',
  correctionCenterLabel: 'text-center text-[11px] font-bold tracking-[0.08em] text-[#98A2B3]',

  correctionActions: 'grid max-w-md gap-2',

  correctionModeStrip:
    'flex items-center gap-2 border-l-2 border-[#D97706] bg-[#FFF8E8]/90 px-3 py-1.5 text-[12px]',
  correctionModeStripIcon: 'shrink-0 text-[#D97706]',
  correctionModeStripText: 'font-medium leading-snug text-[#92400E]',
  correctionModeTitle: 'text-[11px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]',
  scorePeriodLabel:
    'mb-0.5 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[#98A2B3]',
  scoreContextLabel: 'mt-0.5 text-center text-[11px] tabular-nums text-[#C5CDD6]',
  btnApplyCorrection:
    'flex h-[58px] w-full items-center justify-center rounded-md border-2 border-[#101828] bg-[#151B24] px-3 text-[14px] font-bold uppercase tracking-[0.04em] text-white transition-all hover:bg-[#1F2937] active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-45',
  btnApplyCorrectionPrimary:
    'flex min-h-[52px] w-full items-center justify-center rounded-lg bg-accent px-4 text-[15px] font-bold text-accent-foreground shadow-card transition-all hover:opacity-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45',
  btnCancelCorrection:
    'w-full py-1 text-center text-[12px] font-medium text-[#94A3B8] transition-colors hover:text-[#667085] disabled:opacity-45',
  btnCancelCorrectionOutline:
    'flex min-h-[52px] w-full items-center justify-center rounded-lg border-2 border-border bg-card px-4 text-[15px] font-semibold text-foreground transition-all hover:bg-surface active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45',
  queueStripMuted: 'opacity-50',

  auxiliaryStrip:
    'flex shrink-0 items-center gap-2 border-b border-warning/30 bg-warning-soft px-4 py-2 text-xs font-medium text-warning-foreground',

  footerZone: 'shrink-0 border-t border-border bg-card',

  prepActionBtn:
    'mt-2 flex min-h-[52px] w-full items-center justify-center rounded-lg border-2 border-border bg-card px-3 text-sm font-semibold text-foreground transition-all hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50',

  prepActionBtnPrimary:
    'mt-2 flex min-h-[52px] w-full items-center justify-center rounded-lg border-2 border-[var(--judge-corner-red)] bg-[var(--judge-corner-red-tint)] px-3 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50',

  prepActionBtnBlue:
    'mt-2 flex min-h-[52px] w-full items-center justify-center rounded-lg border-2 border-[var(--judge-corner-blue)] bg-[var(--judge-corner-blue-tint)] px-3 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50',

  prepStatusOk: 'mt-2 text-center text-xs font-medium text-success-foreground',

  prepStatusWait: 'text-center text-xs font-medium text-[var(--judge-clock-muted)]',

  resultWinnerCard: 'rounded-lg border-2 px-4 py-3 text-center',

  toolbarBtnLg: 'hidden lg:inline-flex',
}


