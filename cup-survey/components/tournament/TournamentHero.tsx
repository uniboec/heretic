'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays, MapPin } from 'lucide-react'
import { withBasePath } from '@/lib/basePath'
import { routes } from '@/lib/routes'
import { formatMoney } from '@/lib/formatMoney'
import { registrationStages, tournamentDisciplines, tournamentInfo } from '@/lib/config/tournament'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { Button } from '@/components/ui/Button'
import { CountdownTimer } from './CountdownTimer'
import { DisciplineBadge } from './DisciplineBadge'

const copy = tournamentPageCopy.hero
const { poster, venue } = tournamentInfo
const defaultStage = registrationStages.early

interface Props {
  price: number
  stageLabel?: string
  stagePeriod?: string
  closed: boolean
  registrationDeadline: string
}

function MetaIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex size-5 shrink-0 text-info [&_svg]:size-full" aria-hidden="true">
      {children}
    </span>
  )
}

export function TournamentHero({
  price,
  stageLabel,
  stagePeriod,
  closed,
  registrationDeadline,
}: Props) {
  const label = stageLabel ?? defaultStage.label
  const period = stagePeriod ?? defaultStage.bannerDetail

  return (
    <section className="event-hero overflow-hidden rounded-card border border-border bg-card shadow-[0_1px_2px_rgb(15_20_25/0.03)] max-sm:rounded-[0.875rem]">
      <div className="flex flex-col lg:grid lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start lg:gap-8 lg:p-6 lg:px-7">
        <figure className="m-0 w-full shrink-0 max-lg:flex max-lg:max-h-72 max-lg:justify-center max-lg:bg-card">
          <Image
            src={withBasePath(poster.src)}
            alt={poster.alt}
            width={poster.width}
            height={poster.height}
            sizes="(max-width: 1024px) 100vw, 336px"
            className="block h-auto w-full border-b border-border bg-card max-lg:max-h-72 max-lg:w-auto max-lg:max-w-full max-lg:object-contain lg:rounded-card lg:border lg:border-b lg:border-border"
            priority
            unoptimized
          />
        </figure>

        <div className="px-4 pt-5 pb-6 max-sm:px-3.5 max-sm:pt-4 max-sm:pb-5 sm:px-6 sm:pt-6 lg:p-0">
          <header className="flex flex-col gap-5 max-sm:gap-4">
            <h1 className="text-[clamp(1.625rem,5vw,2.125rem)] font-extrabold uppercase leading-[1.12] tracking-[-0.03em] text-foreground max-sm:text-xl lg:text-[2.125rem]">
              <span className="block">Кубок Свердловской области</span>
              <span className="mt-2 block text-[clamp(1rem,3vw,1.25rem)] font-bold normal-case leading-tight tracking-[-0.01em] text-muted max-sm:text-[0.9375rem]">
                по смешанным единоборствам
              </span>
            </h1>

            <ul className="flex flex-col gap-2 p-0 text-[0.9375rem] font-semibold text-foreground max-sm:text-sm sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
              <li className="flex items-center gap-2">
                <MetaIcon>
                  <CalendarDays strokeWidth={1.75} />
                </MetaIcon>
                {tournamentInfo.eventDateLabel}
              </li>
              <li className="flex items-center gap-2">
                <MetaIcon>
                  <MapPin strokeWidth={1.75} />
                </MetaIcon>
                {venue.city}
              </li>
            </ul>

            <div className="flex flex-wrap gap-2">
              {tournamentDisciplines.map((d) => (
                <DisciplineBadge key={d.id} discipline={d.id}>
                  {d.label}
                </DisciplineBadge>
              ))}
            </div>
          </header>

          <div className="mt-6 border-t border-border pt-6 max-sm:mt-5 max-sm:pt-5">
            <span className="inline-flex rounded-full bg-info-soft px-2.5 py-1 text-xs font-bold tracking-wide text-info">
              {label}
            </span>
            <p className="mt-2.5 text-lg text-foreground">
              <strong className="text-[1.75rem] font-extrabold tracking-[-0.02em] text-accent max-sm:text-2xl">
                {formatMoney(price, { plus: false })}
              </strong>
              <span> / {copy.priceNote}</span>
            </p>
            <p className="mt-1 text-[0.9375rem] font-semibold text-muted max-sm:text-sm max-sm:leading-snug">
              {label} действует {period}
            </p>
            {!closed && <CountdownTimer plaque />}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {!closed ? (
              <Link href={withBasePath(routes.register)} className="w-full sm:w-auto">
                <Button emphasis="high" className="w-full sm:min-w-[18rem]">{copy.cta}</Button>
              </Link>
            ) : (
              <Button disabled emphasis="high" className="w-full sm:min-w-[18rem]">{copy.ctaClosed}</Button>
            )}
            <p className="text-center text-[0.9375rem] font-semibold text-muted max-sm:text-sm max-sm:leading-snug">
              {registrationDeadline}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
