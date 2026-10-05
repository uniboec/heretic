import { cn } from '@/lib/cn'

/** Shared Tailwind classes for tournament list pages (participants, bouts, brackets filters). */
export const participantsUi = {
  header: 'mb-5 max-sm:mb-3',
  back: cn(
    'mb-3.5 text-sm font-medium text-muted transition-colors hover:text-accent print:hidden',
    'hidden sm:inline-flex sm:items-center sm:gap-1',
  ),
  title: cn(
    'font-extrabold tracking-tight leading-[1.15] text-foreground',
    'text-2xl sm:text-[2rem]',
  ),
  titleCompact: cn(
    'font-extrabold tracking-tight leading-[1.15] text-foreground',
    'text-[1.375rem] sm:text-2xl sm:text-[2rem]',
  ),
  description: 'mt-2 max-w-[40rem] text-[0.9375rem] leading-snug text-muted',
  descriptionCompact: 'mt-1.5 max-w-[40rem] text-sm leading-snug text-muted sm:mt-2 sm:text-[0.9375rem]',
  meta: 'mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.8125rem] font-medium text-muted',
  metaSep: 'opacity-45',
  metaDisciplines: 'flex flex-wrap gap-1.5',

  statsWrap: 'mb-4 flex flex-col gap-2.5',
  statsPrimary: 'grid grid-cols-3 gap-2.5 max-md:grid-cols-2',
  statsDisciplines:
    'rounded-xl border border-border bg-card px-3.5 py-3 max-sm:px-3 max-sm:py-2.5',
  statsHint:
    'mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted',
  statsDisciplineRow: 'grid grid-cols-2 gap-2',
  stat:
    'rounded-[0.875rem] border border-border bg-card px-4 py-3.5 max-sm:px-3 max-sm:py-2.5',
  statDiscipline:
    'flex items-center justify-between gap-3 rounded-[0.875rem] border border-border bg-surface px-3.5 py-3',
  statValue: 'text-[2rem] font-extrabold leading-none tracking-tight text-foreground tabular-nums max-sm:text-2xl',
  statValueDiscipline: 'text-2xl font-extrabold leading-none tracking-tight text-foreground tabular-nums',
  statLabel: 'mt-1 text-xs font-medium leading-snug text-muted',

  panel: 'overflow-hidden rounded-xl p-0',
  toolbarWrap:
    'border-b border-border bg-gradient-to-b from-card to-surface/60 px-4 py-3.5 sm:px-5 sm:py-4',
  toolbar: 'flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-3',
  search: 'relative min-w-0 lg:flex-[1_1_16rem]',
  searchIcon:
    'pointer-events-none absolute left-3.5 top-1/2 size-[1.125rem] -translate-y-1/2 text-muted',
  searchInput: 'min-h-[2.875rem] pl-11',
  controls:
    'flex flex-wrap items-center gap-2 max-sm:flex-col max-sm:items-stretch lg:flex-[1_1_auto] lg:justify-end',
  controlBtn: cn(
    'inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-card px-3.5 text-sm font-semibold text-foreground transition-[border-color,background-color,color]',
    'hover:border-accent/25 hover:bg-neutral-soft hover:text-foreground',
    'max-sm:w-full max-sm:justify-center',
  ),
  controlBtnActive:
    'border-accent bg-accent-soft text-accent hover:border-accent hover:bg-accent-soft hover:text-accent [&_.participants-control-icon]:text-accent',
  controlIcon: 'participants-control-icon size-4 shrink-0 text-muted',
  filterBadge:
    'inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[0.6875rem] font-bold text-card',
  view: 'flex w-full items-center gap-2 max-sm:flex-col max-sm:items-stretch sm:w-auto',
  viewLabel: 'shrink-0 text-[0.8125rem] font-medium text-muted',
  viewToggle:
    'grid flex-1 grid-cols-3 gap-0.5 rounded-xl border border-border bg-card p-0.5 max-sm:w-full sm:min-w-80 sm:flex-none',
  viewToggleBtn:
    'min-h-11 rounded-[0.5625rem] px-2.5 py-1.5 text-[0.8125rem] font-semibold text-muted transition-[background-color,color,box-shadow] hover:bg-neutral-soft hover:text-foreground',
  viewToggleBtnActive:
    'bg-accent text-card shadow-sm shadow-accent/20 hover:bg-accent-hover hover:text-card',
  reset:
    'px-2 py-1.5 text-sm font-semibold text-accent hover:underline max-sm:w-full max-sm:justify-center',

  filtersOpen:
    'mt-3.5 grid grid-rows-[1fr] overflow-hidden border-t border-border opacity-100 transition-[grid-template-rows,opacity,margin-top,border-color] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
  filtersClosed:
    'grid grid-rows-[0fr] overflow-hidden border-t border-transparent opacity-0 transition-[grid-template-rows,opacity,margin-top,border-color] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
  filtersInner: 'min-h-0 overflow-hidden pt-3.5',

  loading: 'px-6 py-12 text-center text-[0.9375rem] text-muted',
  summary:
    'border-b border-border bg-surface px-4 py-3 text-[0.8125rem] font-medium text-muted sm:px-5',
  listDisplay: 'animate-participants-view-in',

  empty:
    'flex flex-col items-center px-5 py-10 text-center sm:px-8 sm:py-12 max-sm:px-4 max-sm:py-8',
  emptyIcon:
    'flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent max-sm:size-12 [&_svg]:size-8 max-sm:[&_svg]:size-[1.375rem]',
  emptyTitle: 'mt-5 text-lg font-bold text-foreground max-sm:mt-3.5 max-sm:text-base',
  emptyText: 'mt-2 max-w-[22rem] text-[0.9375rem] leading-normal text-muted',
  emptyActions: 'mt-6 flex flex-col items-center gap-3',
  emptyLink: 'text-sm font-semibold text-muted transition-colors hover:text-accent',
} as const

export const disciplineBadgeSm = (discipline: string) =>
  cn(
    'inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold tracking-wide',
    discipline === 'tactic_control' && 'bg-info-soft text-info',
    discipline === 'close_control' && 'bg-success-soft text-success',
  )

export const participantsTableUi = {
  wrap: 'hidden w-full overflow-x-auto bg-card [-webkit-overflow-scrolling:touch] lg:block',
  table: 'w-full min-w-full table-fixed border-collapse bg-card text-sm',
  th: cn(
    'sticky top-0 z-[2] border-b border-border bg-gradient-to-b from-neutral-soft to-neutral-soft',
    'px-3 py-3.5 text-left align-middle text-[0.6875rem] font-bold uppercase tracking-[0.06em]',
    'whitespace-nowrap text-muted shadow-[0_1px_0_rgb(from_var(--color-border)_r_g_b/0.85)] xl:px-3.5',
  ),
  td: cn(
    'border-b border-border bg-card px-3 py-[0.8125rem] align-middle text-sm leading-snug text-foreground',
    'transition-colors xl:px-3.5',
  ),
  rowHover: 'transition-colors hover:bg-neutral-soft',
  col: {
    name: 'pl-5 align-top xl:pl-5',
    club: 'min-w-0',
    gender: 'text-center',
    age: 'text-center',
    discipline: 'whitespace-nowrap',
    category: 'min-w-0',
    status: 'pr-5 text-right xl:pr-5',
  },
  name: 'block text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere]',
  clubCell: 'grid min-w-0 gap-0.5',
  clubName: 'truncate text-[0.8125rem] font-semibold leading-snug text-foreground',
  clubCity: 'truncate text-xs font-medium leading-snug text-muted',
  meta: 'inline-block whitespace-nowrap text-[0.8125rem] leading-snug text-muted',
  categoryLabel:
    'line-clamp-2 text-[0.8125rem] leading-snug text-foreground',
  statusActions: 'inline-flex w-full min-w-0 items-center justify-end gap-2',
  nested: 'w-full min-w-full table-fixed border-collapse',
  groupHeadCell: 'border-b border-border bg-neutral-soft p-0 transition-[border-color] duration-[280ms]',
  groupHeadCellCollapsed: 'border-b-transparent',
  groupBodyCell: 'border-b border-border p-0 transition-[border-color] duration-[280ms]',
  groupBodyCellCollapsed: 'border-b-transparent',
} as const

export const participantsCardUi = {
  list: 'grid gap-3 p-3 max-sm:px-2.5 lg:hidden',
  groupedList: 'flex flex-col lg:hidden',
  group: 'border-b border-border last:border-b-0',
  groupBody: 'border-b border-border',
  groupCards: 'grid gap-2.5 bg-neutral-soft/55 p-3 pb-4 sm:px-4',
  groupHead: cn(
    'flex w-full items-center gap-2.5 border-b border-transparent px-4 py-3.5 text-left transition-[background-color,border-color]',
    'bg-gradient-to-b from-neutral-soft/95 to-card/90 hover:bg-accent-soft/35 sm:px-6',
    'max-sm:flex-wrap max-sm:items-start max-sm:gap-2',
  ),
  groupHeadExpanded: 'border-border',
  groupHeadMain: 'flex min-w-0 flex-1 flex-col gap-0.5 max-sm:flex-[1_1_calc(100%-1.75rem)]',
  groupTitle: 'text-[0.9375rem] font-extrabold leading-snug text-foreground',
  groupSubtitle: 'text-[0.8125rem] leading-snug text-muted',
  groupCount:
    'shrink-0 whitespace-nowrap text-xs font-semibold text-muted max-sm:w-full max-sm:pl-7 max-sm:whitespace-normal',
  groupChevron:
    'size-[1.125rem] shrink-0 text-muted transition-transform duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
  groupChevronOpen: 'rotate-180',
  card: 'rounded-[0.875rem] border border-border bg-card p-3.5 shadow-sm shadow-[rgb(15_20_25/0.04)] max-sm:px-3.5',
  cardHead: 'flex items-start justify-between gap-3',
  cardHeadMain: 'min-w-0 flex-1',
  cardActions: 'inline-flex shrink-0 items-center gap-1',
  cardStatus: 'max-w-full text-center',
  cardName: 'font-bold leading-snug text-foreground [overflow-wrap:anywhere]',
  cardSub: 'mt-1 text-[0.8125rem] text-muted',
  cardMeta: 'mt-3.5 flex flex-col gap-2.5 border-t border-border/90 pt-3.5 text-sm',
  cardMetaSplit: 'grid grid-cols-2 gap-3',
  cardField: 'flex min-w-0 flex-col gap-1',
  cardFieldLabel:
    'text-[0.6875rem] font-semibold uppercase tracking-wide text-muted',
  cardFieldValue: 'text-[0.9375rem] font-semibold leading-snug text-foreground',
  cardFieldCategoryValue: 'flex flex-col items-start gap-2',
  cardCategory: 'block text-sm font-medium leading-snug text-foreground',
  editBtn: cn(
    'inline-flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-muted',
    'transition-[color,background-color] hover:bg-neutral-soft hover:text-accent [&_svg]:size-4 [&_svg]:stroke-2',
  ),
} as const
