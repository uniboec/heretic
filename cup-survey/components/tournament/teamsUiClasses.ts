import { cn } from '@/lib/cn'
import { participantsCardUi } from '@/components/tournament/participantsUiClasses'
import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'

export const teamsUi = {
  backMobile:
    'mb-3 inline-flex items-center text-sm font-medium text-muted transition-colors hover:text-accent sm:hidden',
  rulesBox:
    'rounded-xl border border-border bg-surface/80 px-3.5 py-3 text-xs leading-relaxed text-muted sm:px-4 sm:text-sm',
  panel: cn(tournamentPublicUi.card, 'overflow-hidden'),
  disciplineChips: cn(tournamentPublicUi.chips, 'sm:hidden'),
  disciplineToggleWrap: cn('hidden w-full sm:flex sm:items-center sm:gap-2'),
  mobileList: cn(participantsCardUi.list, 'lg:hidden'),
  mobileCard: (rank: number) =>
    cn(
      participantsCardUi.card,
      rank === 1 && 'border-amber-200/80 bg-amber-50/55 shadow-[0_2px_10px_rgb(217_119_6/0.08)]',
      rank === 2 && 'border-slate-200 bg-slate-50/85',
      rank === 3 && 'border-orange-200/80 bg-orange-50/55',
    ),
  mobileRank: 'flex items-center gap-2 text-sm font-bold text-muted',
  mobilePointsValue: 'text-[1.75rem] font-extrabold leading-none tabular-nums text-foreground',
  mobilePointsLabel:
    'mt-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted',
  mobileMedalGrid: 'mt-3 grid grid-cols-3 gap-2 border-t border-border/90 pt-3',
  mobileMedalCell: 'rounded-lg bg-card/85 px-2 py-2 text-center',
  mobileMedalLabel: 'text-base leading-none',
  mobileMedalValue: 'mt-1 text-sm font-bold tabular-nums text-foreground',
  mobileExtraGrid: 'mt-2 grid grid-cols-2 gap-2',
  mobileExtraCell: 'rounded-lg border border-border/80 bg-card/70 px-3 py-2',
  mobileExtraLabel: 'text-[0.6875rem] font-semibold uppercase tracking-wide text-muted',
  mobileExtraValue: 'mt-0.5 text-sm font-bold tabular-nums text-foreground',
  emptyPanel: 'px-4 py-8 text-center sm:px-6 sm:py-10',
} as const
