'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { tournamentInfo } from '@/lib/config/tournament'
import { formatMoney } from '@/lib/formatMoney'

interface Props {
  title: string
  description: string
}

export function RegistrationPageHeader({ title, description }: Props) {
  const [stageLabel, setStageLabel] = useState('')
  const [stageDetail, setStageDetail] = useState('')
  const [pricePerDiscipline, setPricePerDiscipline] = useState<number | null>(null)

  useEffect(() => {
    fetch(withBasePath('/api/tournament/state'))
      .then((response) =>
        readJsonResponse<{
          stage?: { label?: string; bannerDetail?: string; pricePerDiscipline?: number }
        }>(response),
      )
      .then((result) => {
        if (!result.ok) return
        setStageLabel(result.data.stage?.label ?? '')
        setStageDetail(result.data.stage?.bannerDetail ?? '')
        setPricePerDiscipline(result.data.stage?.pricePerDiscipline ?? null)
      })
      .catch(() => undefined)
  }, [])

  return (
    <header className="mb-5 sm:mb-0">
      <Link
        href={withBasePath('/')}
        className="mb-3 inline-flex text-sm font-medium text-muted transition-colors hover:text-accent"
      >
        ← К турниру
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-[2rem] sm:leading-[1.15]">
        {title}
      </h1>
      <p className="mt-2 max-w-xl text-[0.9375rem] leading-relaxed text-muted">{description}</p>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 max-sm:gap-y-2">
        <span className="text-[0.8125rem] font-medium text-muted">{tournamentInfo.eventDateLabel}</span>
        <span className="text-[0.8125rem] font-medium text-muted">{tournamentInfo.venue.city}</span>
        {stageLabel && (
          <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground">
            {stageLabel}
          </span>
        )}
        {pricePerDiscipline != null && (
          <span className="rounded-full border border-accent/20 bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
            {formatMoney(pricePerDiscipline, { plus: false })} / категория
          </span>
        )}
        {stageDetail && (
          <span className="w-full text-xs text-muted max-sm:w-full sm:w-auto">{stageDetail}</span>
        )}
      </div>
    </header>
  )
}
