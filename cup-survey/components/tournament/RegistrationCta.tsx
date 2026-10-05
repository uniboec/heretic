import Link from 'next/link'
import { withBasePath } from '@/lib/basePath'
import { routes } from '@/lib/routes'
import { tournamentDisciplines, tournamentInfo } from '@/lib/config/tournament'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { DisciplineBadge } from './DisciplineBadge'

const copy = tournamentPageCopy.cta

interface Props {
  closed: boolean
  registrationDeadline: string
  className?: string
}

export function RegistrationCta({ closed, registrationDeadline, className }: Props) {
  return (
    <section
      className={cn(
        'rounded-card border border-accent/20 bg-gradient-to-b from-accent-soft to-card px-6 py-8 text-center max-sm:px-4 max-sm:py-6',
        className,
      )}
    >
      <h2 className="text-[clamp(1.25rem,3vw,1.5rem)] font-extrabold tracking-tight text-foreground max-sm:text-lg">
        {copy.finalTitle}
      </h2>
      <p className="mt-1.5 text-base font-semibold text-muted max-sm:text-sm">{registrationDeadline}</p>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {tournamentDisciplines.map((d) => (
          <DisciplineBadge key={d.id} discipline={d.id}>
            {d.label}
          </DisciplineBadge>
        ))}
      </div>

      <p className="mt-3.5 text-base font-semibold text-foreground max-sm:text-sm">
        {tournamentInfo.eventDateLabel} · {tournamentInfo.venue.city}
      </p>

      {!closed ? (
        <Link href={withBasePath(routes.register)} className="mt-6 inline-block w-full sm:w-auto">
          <Button size="lg" className="w-full sm:min-w-[18rem]">
            {copy.register}
          </Button>
        </Link>
      ) : (
        <Button disabled size="lg" className="mt-6 w-full sm:min-w-[18rem]">
          {tournamentPageCopy.hero.ctaClosed}
        </Button>
      )}
    </section>
  )
}
