import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { divisionCardIcons } from '@/lib/icons/tournament'

const copy = tournamentPageCopy.divisions

export function TournamentDivisions() {
  const NoviceIcon = divisionCardIcons.novice
  const ExperiencedIcon = divisionCardIcons.experienced

  return (
    <section
      id="divisions"
      className="scroll-mt-28 rounded-card border border-border bg-card px-4 py-5 max-sm:px-3.5 max-sm:py-4 sm:px-6 sm:py-6"
    >
      <h2 className="text-xl font-extrabold tracking-tight text-foreground max-sm:text-lg sm:text-[1.375rem]">
        {copy.title}
      </h2>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted max-sm:text-sm">{copy.lead}</p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <article className="rounded-card border border-info/20 bg-gradient-to-b from-info-soft to-card p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center text-info [&_svg]:size-full" aria-hidden="true">
              <NoviceIcon strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-info">{copy.novice.title}</p>
              <h3 className="mt-1 text-[1.0625rem] font-bold text-foreground">{copy.novice.level}</h3>
            </div>
          </div>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-4 text-[0.9375rem] leading-normal text-muted">
            {copy.novice.criteria.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-card border border-success/20 bg-gradient-to-b from-success-soft to-card p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center text-success [&_svg]:size-full" aria-hidden="true">
              <ExperiencedIcon strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-success">
                {copy.experienced.title}
              </p>
              <h3 className="mt-1 text-[1.0625rem] font-bold text-foreground">{copy.experienced.level}</h3>
            </div>
          </div>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-4 text-[0.9375rem] leading-normal text-muted">
            {copy.experienced.criteria.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>

      <p className="mt-4 text-[0.8125rem] text-muted">* {copy.footnote}</p>
      <p className="mt-3 text-[0.9375rem] leading-snug text-foreground">{copy.disclaimer}</p>
    </section>
  )
}
