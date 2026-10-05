import { cn } from '@/lib/cn'
import { eventCard, eventPage } from '@/lib/ui/eventSurfaceStyles'

/** Shared Tailwind classes for public tournament pages (/brackets, /bouts). */
export const tournamentPublicUi = {
  page: eventPage,
  card: eventCard,
  pageStack: cn('flex flex-col gap-4 max-sm:gap-3'),

  bracketsGrid: cn('grid gap-3 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start lg:gap-4'),

  bracketsSidebar: 'public-brackets-sidebar lg:col-start-1 lg:row-start-1',

  bracketsCategoryList: cn(
    'flex gap-2',
    'max-lg:-mx-1 max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:pb-1 max-lg:snap-x max-lg:snap-proximity',
    'max-lg:[-webkit-overflow-scrolling:touch] max-lg:overscroll-x-contain max-lg:[scrollbar-width:thin]',
    'lg:max-h-[65vh] lg:flex-col lg:gap-2 lg:overflow-y-auto lg:overflow-x-visible',
  ),

  bracketsCategoryItem: 'max-lg:shrink-0 max-lg:snap-start lg:w-full',

  bracketsCategoryButton: cn(
    'max-lg:min-w-[12.5rem] max-lg:max-w-[min(85vw,16rem)] max-lg:shrink-0',
  ),

  bracketsMain: cn(
    'public-brackets-main min-w-0 p-4 max-md:overflow-visible lg:col-start-2 lg:row-start-1 lg:p-5 lg:px-6',
  ),

  bracketsPanelTitle: cn(
    'text-base font-semibold leading-snug [overflow-wrap:anywhere]',
    'max-lg:text-[0.9375rem]',
  ),

  bracketsPanelHeader: 'max-lg:px-3.5 max-lg:py-3',

  headerRow: 'flex flex-wrap items-end justify-between gap-4',

  headerRowBoutsMobile: 'max-md:flex-col max-md:items-stretch',

  printBtn: cn(
    'inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[0.625rem]',
    'border border-border bg-card px-4 text-sm font-semibold text-foreground no-underline',
    'transition-[border-color,background-color,color]',
    'hover:border-accent/30 hover:bg-surface hover:text-accent',
    'disabled:cursor-not-allowed disabled:opacity-55',
  ),

  printBtnIconOnly: 'max-lg:w-11 max-lg:min-h-11 max-lg:px-0',

  printBtnFullWidth: 'max-md:w-full max-md:min-h-11',

  printBtnLabel: 'max-lg:hidden',

  chips: cn(
    'flex flex-wrap gap-2',
    'max-md:flex-nowrap max-md:overflow-x-auto max-md:mx-[-0.25rem] max-md:pb-1',
    'max-md:snap-x max-md:snap-proximity max-md:[scrollbar-width:none]',
    'max-md:[&::-webkit-scrollbar]:hidden',
  ),

  chip: cn(
    '!min-h-8 !rounded-full !border !border-border !bg-card !px-3.5 !py-1.5',
    '!text-[0.8125rem] !font-semibold !text-foreground',
    'hover:!border-accent/25 hover:!bg-surface',
    'max-md:shrink-0 max-md:snap-start max-md:!min-h-9 max-md:!px-3',
  ),

  chipActive: cn(
    '!border-accent !bg-accent !text-card',
    'hover:!border-accent hover:!bg-accent hover:!text-card',
  ),

  chipCount: 'ml-1 font-medium opacity-85',

  embeddedFilterRow:
    'border-b border-border bg-surface/40 px-4 py-2.5 sm:px-5 sm:py-3',

  boutsFilterPanel: cn(
    'flex flex-col gap-2 rounded-xl border border-border bg-card p-2 sm:gap-2.5 sm:p-2.5',
    'print:hidden',
    'max-md:sticky max-md:top-[var(--header-height)] max-md:z-[21]',
    'max-md:-mx-1 max-md:shadow-[0_1px_0_rgb(15_23_42/0.06)]',
    'max-md:bg-[color-mix(in_srgb,var(--color-card)_96%,transparent)] max-md:backdrop-blur-[10px]',
  ),

  boutsFilterRow: 'flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-stretch sm:gap-2.5',

  boutsFilterRowLabel: cn(
    'flex shrink-0 items-center text-[0.6875rem] font-semibold uppercase tracking-[0.04em] text-muted',
    'sm:w-[4.5rem] sm:justify-end sm:pt-2 sm:text-right',
  ),

  boutsSegmented: cn(
    'flex min-w-0 gap-0.5 rounded-[0.625rem] border border-border bg-surface/70 p-0.5',
  ),

  boutsSegmentedEqual: 'w-full',

  boutsSegmentedScroll: cn(
    'max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-0.5',
    'max-md:snap-x max-md:snap-proximity max-md:[scrollbar-width:none]',
    'max-md:[&::-webkit-scrollbar]:hidden',
  ),

  boutsSegmentBtn: cn(
    'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2.5',
    'text-[0.8125rem] font-semibold text-muted transition-[background-color,color,box-shadow]',
    'hover:bg-neutral-soft/80 hover:text-foreground',
  ),

  boutsSegmentBtnEqual: 'flex-1',

  boutsSegmentBtnScroll: 'max-md:shrink-0 max-md:flex-none max-md:px-3',

  boutsSegmentBtnActive: cn(
    'bg-accent text-card shadow-sm shadow-accent/20',
    'hover:bg-accent-hover hover:text-card',
  ),

  boutsSegmentCount: cn(
    'inline-flex min-w-[1.25rem] items-center justify-center rounded-full',
    'bg-muted/30 px-1.5 py-0.5 text-[0.6875rem] font-bold leading-none tabular-nums text-muted',
  ),

  boutsSegmentCountActive: 'bg-card/20 text-card',

  matFilterWrap: cn(
    'block',
    'max-md:sticky max-md:top-[var(--header-height)] max-md:z-[21]',
    'max-md:-mx-4 max-md:border-b max-md:border-border max-md:px-4 max-md:py-2.5',
    'max-md:bg-[color-mix(in_srgb,var(--color-surface)_94%,transparent)] max-md:backdrop-blur-[10px]',
  ),

  boutsList: cn('flex flex-col gap-3 p-2.5 max-md:gap-2.5 sm:p-4 sm:px-5'),

  emptyCard: 'p-10 text-center text-muted sm:px-6',

  boutsPanel: 'p-5 px-4',

  boutsPanelCard: 'max-md:-mx-1 max-md:rounded-[0.875rem]',

  bracketEmpty:
    'rounded-[0.875rem] border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted',

  championCard:
    'max-w-md rounded-[0.875rem] border border-border bg-card px-6 py-5 shadow-[0_1px_2px_rgb(15_23_42/0.04)]',
  championLabel:
    'mb-3 text-xs font-bold uppercase tracking-wide text-muted',
  championName: 'text-lg font-bold text-foreground',
  championClub: 'mt-1.5 text-sm text-muted',
  championPlacement: 'mt-3 text-sm font-semibold text-accent',
} as const

export const boutCardUi = {
  card: cn(
    'overflow-hidden rounded-[0.875rem] border border-border bg-card text-[0.8125rem]',
    'shadow-[0_1px_2px_rgb(15_20_25/0.03)] transition-[border-color,box-shadow]',
    'hover:border-accent/18 hover:shadow-[0_2px_8px_rgb(15_23_42/0.05)]',
    'max-md:rounded-[0.625rem]',
  ),
  faceoff: cn(
    'flex items-center justify-center gap-2.5 px-3.5 py-2.5 pb-3',
    'max-md:gap-2 max-md:px-3 sm:gap-3 sm:p-4',
  ),
  vs: cn(
    'flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface',
    'text-[0.6875rem] font-extrabold tracking-wide text-muted',
    'max-md:size-7 max-md:text-[0.5625rem]',
  ),
  participant: 'flex min-w-0 max-w-[calc(50%-1.125rem)] flex-1 items-center',
  participantLeft: 'justify-end',
  participantRight: 'justify-start',
  side: 'flex min-w-0 flex-col justify-center gap-0.5',
  sideLeft: 'items-start text-left',
  sideRight: 'items-end text-right',
  name: cn(
    'overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold leading-tight text-foreground',
    'sm:text-[0.9375rem] max-md:line-clamp-2 max-md:whitespace-normal max-md:text-[0.8125rem]',
  ),
  nameWinner:
    'text-[color-mix(in_srgb,var(--color-success)_88%,var(--color-foreground))]',
  nameLoser: 'text-muted opacity-80',
  winnerBadge:
    'mb-0.5 inline-flex items-center rounded-full bg-success-soft/80 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-success',
  meta: cn(
    'overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-tight text-muted',
    'max-md:line-clamp-1 max-md:whitespace-normal max-md:text-[0.6875rem]',
  ),
  pending: cn('text-[0.8125rem] italic leading-snug text-muted max-md:text-xs'),
  pendingBye: 'not-italic',
  category: cn(
    'min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-foreground',
    'sm:overflow-hidden sm:text-ellipsis sm:whitespace-nowrap',
  ),
  categoryMobile:
    'text-sm font-semibold leading-snug text-foreground max-md:line-clamp-2',
  headTags: 'ml-auto inline-flex shrink-0 flex-nowrap items-center gap-1.5',
  tag: 'inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-bold tracking-wide text-accent',
  order:
    'inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums text-muted',
  placementBadge:
    'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[0.625rem] font-extrabold uppercase tracking-[0.04em] sm:text-[0.6875rem]',
  placementBadgeKind: {
    final:
      'border-[color-mix(in_srgb,#d4a017_55%,var(--color-border))] bg-[color-mix(in_srgb,#f6e7b8_72%,var(--color-card))] text-[#7a5a00]',
    bronze:
      'border-[color-mix(in_srgb,#b87333_55%,var(--color-border))] bg-[color-mix(in_srgb,#f3dcc8_72%,var(--color-card))] text-[#7a4518]',
  },
} as const
