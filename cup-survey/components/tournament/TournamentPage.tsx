'use client'

import { useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { TariffCard } from './TariffCard'
import { registrationStages, registrationStagesList, registrationClosesAt } from '@/lib/config/tournament'
import {
  EDIT_REGISTRATION_FAQ_QUESTION,
  registrationEditFaqAnswer,
  registrationFeesNote,
  registrationDeadlineLabel,
  tournamentPageCopy,
} from '@/lib/content/tournament-page'
import { cn } from '@/lib/cn'
import { RegistrationCta } from './RegistrationCta'
import { TournamentCategories } from './TournamentCategories'
import { TournamentDivisions } from './TournamentDivisions'
import { TournamentEssentials } from './TournamentEssentials'
import { TournamentHero } from './TournamentHero'
import { TournamentCombatContentPartner } from './TournamentCombatContentPartner'
import { TournamentPartnerBonus } from './TournamentPartnerBonus'
import { TournamentParticipantsTeaser } from './TournamentParticipantsTeaser'
import { TournamentPublicDiscounts } from './TournamentPublicDiscounts'
import {
  eventFaqAnswer,
  eventFaqAnswerInner,
  eventFaqAnswerWrap,
  eventFaqIcon,
  eventFaqItem,
  eventFaqList,
  eventFaqQuestion,
  eventPage,
  eventTimeline,
  eventTimelineItem,
  eventTimelineLabel,
  eventTimelineLine,
  eventTimelineMarker,
  eventTimelineTime,
} from '@/lib/ui/eventSurfaceStyles'
import type { TournamentPageState } from '@/lib/tournament/pageState'

const copy = tournamentPageCopy

interface Props {
  initialState: TournamentPageState
}

export function TournamentPage({ initialState }: Props) {
  const [state, setState] = useState(initialState)

  useEffect(() => {
    fetch(withBasePath('/api/tournament/state'))
      .then((response) => readJsonResponse<TournamentPageState>(response))
      .then((result) => {
        if (result.ok) setState(result.data)
      })
      .catch(() => undefined)
  }, [])

  const price = state.stage?.pricePerDiscipline ?? registrationStages.early.pricePerDiscipline
  const closed = state.closed
  const stages = state.stages.length > 0 ? state.stages : registrationStagesList
  const stagePeriod = state.stage?.bannerDetail ?? registrationStages.early.bannerDetail
  const registrationCloseAt = state.registrationClosesAt ?? registrationClosesAt
  const registrationDeadline = registrationDeadlineLabel(registrationCloseAt)
  const feesNote = registrationFeesNote(registrationCloseAt)

  return (
    <div className={cn(eventPage, 'flex flex-col gap-5 max-sm:gap-4 lg:gap-6')}>
      <TournamentHero
        price={price}
        stageLabel={state.stage?.label ?? registrationStages.early.label}
        stagePeriod={stagePeriod}
        closed={closed}
        registrationDeadline={registrationDeadline}
      />

      <TournamentParticipantsTeaser stats={state.stats} closed={closed} />

      <div className="flex min-w-0 flex-col gap-5 max-sm:gap-4 lg:gap-6">
        <TournamentEssentials />

        <div className="flex flex-col gap-3.5">
          <TournamentPartnerBonus />
          <TournamentCombatContentPartner />
        </div>

        <TournamentPublicDiscounts discounts={state.publicDiscounts} />

        <TournamentDivisions />

        <TournamentCategories />

        <ContentSection id="fees" title={copy.fees.title}>
          <p className="text-[0.9375rem] leading-relaxed text-muted max-sm:text-sm">{feesNote}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stages.map((stage) => (
              <TariffCard
                key={stage.id}
                period={stage.period}
                pricePerDiscipline={stage.pricePerDiscipline}
                current={state.stage?.id === stage.id}
              />
            ))}
          </div>
        </ContentSection>

        <ContentSection id="schedule" title={copy.schedule.title} compact>
          <ol className={eventTimeline}>
            {copy.schedule.items.map((item, index) => (
              <li key={item.label} className={eventTimelineItem}>
                <div className={eventTimelineMarker} aria-hidden="true" />
                <div>
                  <p className={eventTimelineTime}>{item.time}</p>
                  <p className={eventTimelineLabel}>{item.label}</p>
                </div>
                {index < copy.schedule.items.length - 1 && (
                  <div className={eventTimelineLine} aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </ContentSection>

        <ContentSection id="faq" title={copy.faq.title}>
          <div className={eventFaqList}>
            {copy.faq.items.map((item) => (
              <details key={item.q} className={eventFaqItem}>
                <summary className={eventFaqQuestion}>
                  <span>{item.q}</span>
                  <span className={eventFaqIcon} aria-hidden="true">+</span>
                </summary>
                <div className={eventFaqAnswerWrap}>
                  <div className={eventFaqAnswerInner}>
                    <p className={eventFaqAnswer}>
                      {item.q === EDIT_REGISTRATION_FAQ_QUESTION
                        ? registrationEditFaqAnswer(registrationCloseAt)
                        : item.a}
                    </p>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </ContentSection>

        <RegistrationCta closed={closed} registrationDeadline={registrationDeadline} />
      </div>
    </div>
  )
}

function ContentSection({
  id,
  title,
  children,
  compact = false,
}: {
  id: string
  title: string
  children: React.ReactNode
  compact?: boolean
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-28 rounded-card border border-border bg-card px-4 py-5 max-sm:px-3.5 sm:px-6 sm:py-6${compact ? ' max-sm:py-4 sm:py-4' : ''}`}
    >
      <h2 className="text-xl font-extrabold tracking-tight text-foreground max-sm:text-lg sm:text-[1.375rem]">
        {title}
      </h2>
      <div className={compact ? 'mt-4' : 'mt-5'}>{children}</div>
    </section>
  )
}
