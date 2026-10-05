import { cn } from '@/lib/cn'
import { participantsTableUi } from '@/components/tournament/participantsUiClasses'

const tableScrollWrap =
  'w-full overflow-x-auto [-webkit-overflow-scrolling:touch]'

export const athleteRatingsPublicTableUi = {
  wrap: tableScrollWrap,
  table: cn(participantsTableUi.table, 'table-auto min-w-[44rem]'),
  rankTh: cn(participantsTableUi.th, 'w-12 text-center'),
  rankTd: cn(participantsTableUi.td, 'w-12 align-top text-center font-semibold tabular-nums'),
  athleteTh: cn(participantsTableUi.th, 'min-w-[12rem]'),
  athleteTd: cn(participantsTableUi.td, 'min-w-[12rem] align-top whitespace-normal'),
  ageTh: cn(participantsTableUi.th, 'w-24 text-center'),
  ageTd: cn(participantsTableUi.td, 'w-24 align-top text-center whitespace-nowrap'),
  resultTh: cn(participantsTableUi.th, 'min-w-[10rem]'),
  resultTd: cn(participantsTableUi.td, 'min-w-[10rem] align-top whitespace-normal'),
  winsTh: cn(participantsTableUi.th, 'w-20 text-center'),
  winsTd: cn(participantsTableUi.td, 'w-20 align-top text-center tabular-nums'),
  pointsTh: cn(participantsTableUi.th, 'w-24 text-right'),
  pointsTd: cn(
    participantsTableUi.td,
    'w-24 align-top text-right font-semibold tabular-nums whitespace-nowrap',
  ),
}

export const athleteRatingsAdminTableUi = {
  wrap: cn(tableScrollWrap, 'rounded-xl border border-border'),
  table: cn(participantsTableUi.table, 'table-auto min-w-[76rem]'),
  rankTh: cn(participantsTableUi.th, 'w-16 text-center'),
  rankTd: cn(participantsTableUi.td, 'w-16 align-top text-center'),
  rankValue: 'font-semibold tabular-nums',
  rankUnranked: 'mx-auto block max-w-[9rem] text-left text-xs leading-snug text-muted',
  athleteTh: cn(participantsTableUi.th, 'min-w-[12rem]'),
  athleteTd: cn(participantsTableUi.td, 'min-w-[12rem] align-top whitespace-normal'),
  ageTh: cn(participantsTableUi.th, 'w-20 text-center'),
  ageTd: cn(participantsTableUi.td, 'w-20 align-top text-center whitespace-nowrap'),
  scoreTh: cn(participantsTableUi.th, 'w-[4.5rem] text-right'),
  scoreTd: cn(
    participantsTableUi.td,
    'w-[4.5rem] align-top text-right font-medium tabular-nums whitespace-nowrap',
  ),
  placementsTh: cn(participantsTableUi.th, 'min-w-[8.5rem]'),
  placementsTd: cn(participantsTableUi.td, 'min-w-[8.5rem] align-top text-sm leading-snug'),
  countTh: cn(participantsTableUi.th, 'w-12 px-1 text-center text-xs'),
  countTd: cn(participantsTableUi.td, 'w-12 px-1 align-top text-center tabular-nums'),
  totalTh: cn(participantsTableUi.th, 'w-24 text-right'),
  totalTd: cn(
    participantsTableUi.td,
    'w-24 align-top text-right font-semibold tabular-nums whitespace-nowrap',
  ),
}
