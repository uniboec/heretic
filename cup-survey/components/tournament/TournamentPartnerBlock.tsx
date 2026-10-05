import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface PartnerBlockCopy {
  badge: string
  title: string
  partnerName: string
  description: string
  amount?: string
  footnote?: string
  cta: string
  url: string
}

type PartnerBlockVariant = 'fightcrm' | 'combatcontent'

export function TournamentPartnerBlock({
  id,
  variant,
  copy,
  logoSrc,
}: {
  id: string
  variant: PartnerBlockVariant
  copy: PartnerBlockCopy
  logoSrc: string
}) {
  const isCombatContent = variant === 'combatcontent'

  return (
    <aside
      id={id}
      className="scroll-mt-28 rounded-card border border-partner-combat/22 bg-gradient-to-br from-partner-combat-soft via-card to-[#fffaf8] p-4 shadow-[inset_0_1px_0_rgb(227_62_29/0.06)] sm:px-5 sm:py-[1.125rem]"
      aria-labelledby={`${id}-title`}
    >
      <div className="grid items-start gap-3.5 max-sm:grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-x-5 sm:gap-y-3.5">
        <a
          href={copy.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex size-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-[0.875rem] border border-partner-combat/18 bg-black shadow-[0_4px_14px_rgb(227_62_29/0.18)] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_6px_18px_rgb(227_62_29/0.24)]',
            isCombatContent && 'bg-black',
          )}
          aria-label={copy.partnerName}
        >
          <Image
            src={logoSrc}
            alt={copy.partnerName}
            width={72}
            height={72}
            unoptimized
            className={cn(
              'block size-full',
              isCombatContent ? 'object-contain p-1' : 'object-cover',
            )}
          />
        </a>

        <div className="min-w-0">
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-widest text-partner-combat">
            {copy.badge}
          </p>
          <p
            id={`${id}-title`}
            className="mt-0.5 text-[1.0625rem] font-extrabold leading-snug tracking-tight text-foreground max-sm:text-base sm:text-lg"
          >
            {copy.title}
            {copy.amount ? (
              <>
                {' '}
                <span className="ml-1.5 inline-flex items-center rounded-lg border border-partner-combat/20 bg-white/90 px-2 py-0.5 text-[0.9375rem] font-extrabold tracking-tight whitespace-nowrap text-partner-combat max-sm:ml-1 max-sm:inline max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:text-inherit">
                  {copy.amount}
                </span>
              </>
            ) : null}
          </p>
          <p className="mt-1.5 text-sm leading-snug text-muted">{copy.description}</p>
          {copy.footnote ? (
            <p className="mt-1.5 text-xs leading-snug text-[rgb(127_29_29/0.72)]">{copy.footnote}</p>
          ) : null}
        </div>

        <a
          href={copy.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-partner-combat px-4 py-2.5 text-sm font-bold whitespace-nowrap text-card no-underline shadow-[0_2px_8px_rgb(227_62_29/0.28)] transition-[background-color,gap,box-shadow] hover:gap-1.5 hover:bg-partner-combat-dark hover:shadow-[0_4px_12px_rgb(227_62_29/0.32)] max-sm:col-span-full max-sm:w-full sm:justify-self-end [&_svg]:size-[1.125rem]"
        >
          <span>{copy.cta}</span>
          <ArrowRight strokeWidth={1.75} aria-hidden="true" />
        </a>
      </div>
    </aside>
  )
}
