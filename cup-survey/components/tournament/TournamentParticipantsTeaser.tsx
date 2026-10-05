import Link from 'next/link'
import { ChevronRight, Users } from 'lucide-react'
import { withBasePath } from '@/lib/basePath'
import { routes } from '@/lib/routes'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { DisciplineBadge } from './DisciplineBadge'

const copy = tournamentPageCopy.participantsTeaser
const statLabels = tournamentPageCopy.participants.stats

interface ParticipantStats {
  athletes: number
  clubs: number
  entries: number
  tacticControl: number
  closeControl: number
}

interface Props {
  stats: ParticipantStats | null
  closed?: boolean
}

export function TournamentParticipantsTeaser({ stats, closed = false }: Props) {
  const hasAthletes = !closed && (stats?.athletes ?? 0) > 0

  return (
    <Link
      href={withBasePath(routes.athletes)}
      className="group block rounded-card border border-info/18 bg-gradient-to-br from-info-soft via-card to-card p-4 text-inherit no-underline transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-info/35 hover:shadow-[0_8px_24px_rgb(26_79_214/0.1)] sm:px-5 sm:py-[1.125rem]"
    >
      <div className="grid items-center gap-3.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-5 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:gap-x-6">
        <div
          className="flex size-11 items-center justify-center rounded-[0.875rem] border border-info/15 bg-card text-info shadow-[0_1px_2px_rgb(15_20_25/0.04)] [&_svg]:size-[1.375rem]"
          aria-hidden="true"
        >
          <Users strokeWidth={1.75} />
        </div>

        <div>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-widest text-info">
            {copy.eyebrow}
          </p>
          <p className="mt-0.5 text-lg font-extrabold leading-tight tracking-tight text-foreground lg:text-xl">
            {hasAthletes ? copy.titleWithAthletes : copy.titleEmpty}
          </p>
          <p className="mt-1 text-sm leading-snug text-muted">
            {hasAthletes ? copy.descriptionLive : copy.descriptionEmpty}
          </p>
        </div>

        {hasAthletes && stats && (
          <div
            className="event-participants-teaser-stats grid grid-cols-3 gap-2 sm:col-span-full lg:col-auto lg:min-w-60"
            aria-label="Статистика участников"
          >
            <div className="flex flex-col gap-0.5 rounded-xl border border-info/12 bg-white/72 px-3 py-2.5">
              <span className="text-xl font-extrabold leading-none tracking-tight text-foreground">
                {stats.athletes}
              </span>
              <span className="text-[0.6875rem] font-semibold leading-snug text-muted">
                {statLabels.athletes}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-info/12 bg-white/72 px-3 py-2.5">
              <span className="text-xl font-extrabold leading-none tracking-tight text-foreground">
                {stats.clubs}
              </span>
              <span className="text-[0.6875rem] font-semibold leading-snug text-muted">
                {statLabels.clubs}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-info/12 bg-white/72 px-3 py-2.5">
              <span className="text-xl font-extrabold leading-none tracking-tight text-foreground">
                {stats.entries}
              </span>
              <span className="text-[0.6875rem] font-semibold leading-snug text-muted">
                {statLabels.entries}
              </span>
            </div>
          </div>
        )}

        <span className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-info px-4 py-2.5 text-sm font-bold whitespace-nowrap text-card transition-colors group-hover:bg-[#1640c4] sm:justify-self-end [&_svg]:size-[1.125rem]">
          <span>{copy.cta}</span>
          <ChevronRight strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>

      {hasAthletes && stats && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-info/12 pt-3.5">
          <DisciplineBadge discipline="tactic_control" size="sm">
            {statLabels.tactic}: {stats.tacticControl}
          </DisciplineBadge>
          <DisciplineBadge discipline="close_control" size="sm">
            {statLabels.close}: {stats.closeControl}
          </DisciplineBadge>
        </div>
      )}
    </Link>
  )
}
