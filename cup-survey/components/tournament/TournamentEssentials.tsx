import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { essentialsAwardIcons, essentialsFormatIcons } from '@/lib/icons/tournament'

const copy = tournamentPageCopy.essentials

export function TournamentEssentials() {
  return (
    <section
      id="essentials"
      className="scroll-mt-28 rounded-card border border-border bg-card px-4 py-5 max-sm:px-3.5 max-sm:py-4 sm:px-6 sm:py-6"
    >
      <h2 className="text-xl font-extrabold tracking-tight text-foreground max-sm:text-lg sm:text-[1.375rem]">
        {copy.title}
      </h2>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted max-sm:text-sm">{copy.lead}</p>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:items-start">
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-muted">
            {copy.format.title}
          </h3>
          <div className="mt-3.5 flex flex-col gap-2.5">
            {copy.format.items.map((item) => {
              const Icon = essentialsFormatIcons[item.icon]

              return (
                <article
                  key={item.title}
                  className="flex items-start gap-3.5 rounded-[0.875rem] border border-border bg-surface p-4 max-sm:gap-3 max-sm:p-3.5"
                >
                  <span className="mt-0.5 flex size-[1.375rem] shrink-0 items-center justify-center text-info max-sm:size-5 [&_svg]:size-full" aria-hidden="true">
                    <Icon strokeWidth={1.75} />
                  </span>
                  <div>
                    <h4 className="text-[0.9375rem] font-bold leading-snug text-foreground max-sm:text-sm">
                      {item.title}
                    </h4>
                    <p className="mt-1 text-sm leading-normal text-muted max-sm:text-[0.8125rem]">
                      {item.text}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-muted">
            {copy.awards.title}
          </h3>
          <ul className="mt-3.5 flex flex-col overflow-hidden rounded-[0.875rem] border border-border bg-gradient-to-b from-success-soft to-card">
            {copy.awards.items.map((item, index) => {
              const Icon = essentialsAwardIcons[item.icon]

              return (
                <li
                  key={item.title}
                  className={`flex items-start gap-3 px-4 py-3.5 max-sm:px-3.5 max-sm:py-3 ${index > 0 ? 'border-t border-success/12' : ''}`}
                >
                  <span className="mt-0.5 flex size-[1.375rem] shrink-0 items-center justify-center text-success max-sm:size-5 [&_svg]:size-full" aria-hidden="true">
                    <Icon strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-[0.9375rem] font-bold leading-snug text-foreground max-sm:text-sm">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-sm leading-snug text-muted max-sm:text-[0.8125rem]">
                      {item.text}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
