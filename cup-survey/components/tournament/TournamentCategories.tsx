import {
  fseAgeDivisions,
  formatAgeDivisionAgeRange,
  type FseAgeDivision,
} from '@/lib/config/fseCategories'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { cn } from '@/lib/cn'

const copy = tournamentPageCopy.categories

type AgeGroupId = 'children' | 'youth' | 'juniors' | 'adults' | 'veterans'

const ageGroupOrder: AgeGroupId[] = ['children', 'youth', 'juniors', 'adults', 'veterans']

const sheetGridClass =
  'grid grid-cols-[2.25rem_minmax(5.5rem,7rem)_minmax(3.5rem,4.5rem)_minmax(0,1fr)] items-start gap-x-3 gap-y-2'

function getAgeGroupId(division: FseAgeDivision): AgeGroupId {
  if (division.label.startsWith('Ветераны')) return 'veterans'
  if (division.label.startsWith('Мужчины') || division.label.startsWith('Женщины')) return 'adults'
  if (division.label.startsWith('Юниоры') || division.label.startsWith('Юниорки')) return 'juniors'
  if (division.label.startsWith('Юноши') || division.label.startsWith('Девушки')) return 'youth'
  return 'children'
}

function interleaveByAgeStep(divisions: FseAgeDivision[]): FseAgeDivision[] {
  const males = divisions.filter((division) => division.gender === 'male')
  const females = divisions.filter((division) => division.gender === 'female')
  const paired: FseAgeDivision[] = []

  for (let index = 0; index < Math.max(males.length, females.length); index += 1) {
    if (males[index]) paired.push(males[index])
    if (females[index]) paired.push(females[index])
  }

  return paired
}

function getAgeGroups() {
  return ageGroupOrder
    .map((groupId) => {
      const divisions = fseAgeDivisions.filter((division) => getAgeGroupId(division) === groupId)
      return {
        id: groupId,
        label: copy.groups[groupId],
        divisions: interleaveByAgeStep(divisions),
      }
    })
    .filter((group) => group.divisions.length > 0)
}

function GenderMark({ gender }: { gender: FseAgeDivision['gender'] }) {
  return (
    <span
      className={cn(
        'inline-flex size-[1.625rem] items-center justify-center rounded-full text-[0.6875rem] font-extrabold leading-none',
        gender === 'male' ? 'bg-info-soft text-info' : 'bg-accent-soft text-accent',
      )}
      aria-label={gender === 'male' ? 'Мужская категория' : 'Женская категория'}
    >
      {gender === 'male' ? 'М' : 'Ж'}
    </span>
  )
}

function DivisionRow({ division }: { division: FseAgeDivision }) {
  const isMale = division.gender === 'male'

  return (
    <article
      className={cn(
        'border-t border-border/95 px-4 first:border-t-0',
        'max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)_auto] max-sm:[grid-template-areas:"gender_division_age"_"weights_weights_weights"] max-sm:items-center max-sm:gap-x-2.5 max-sm:gap-y-2 max-sm:py-3.5',
        sheetGridClass,
        'sm:py-2',
      )}
    >
      <div className="m-0 min-w-0 max-sm:[grid-area:gender] max-sm:self-center">
        <GenderMark gender={division.gender} />
      </div>
      <div className="m-0 min-w-0 max-sm:[grid-area:division]">
        <span
          className={cn(
            'block text-sm leading-snug text-foreground max-sm:text-[0.9375rem] max-sm:leading-tight sm:font-extrabold',
            isMale ? 'max-sm:text-info' : 'max-sm:text-accent',
          )}
        >
          {division.label}
        </span>
      </div>
      <div className="m-0 min-w-0 max-sm:[grid-area:age] max-sm:justify-self-end max-sm:text-right">
        <span className="block text-sm font-semibold text-muted max-sm:text-[0.8125rem] max-sm:whitespace-nowrap">
          {formatAgeDivisionAgeRange(division)}
        </span>
      </div>
      <div className="m-0 min-w-0 max-sm:[grid-area:weights] max-sm:border-t max-sm:border-border/85 max-sm:pt-2.5">
        <div className="flex flex-wrap gap-1.5 max-sm:gap-[0.3125rem]">
          {division.weightCategories.map((weight) => (
            <span
              key={weight.id}
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold leading-tight whitespace-nowrap text-foreground max-sm:px-[0.4375rem] max-sm:py-[0.1875rem] max-sm:text-[0.6875rem]',
                isMale
                  ? 'border-info-border/75 bg-info-soft/90'
                  : 'border-accent-muted/75 bg-accent-soft/90',
              )}
            >
              {weight.label}
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}

export function TournamentCategories() {
  const ageGroups = getAgeGroups()

  return (
    <section
      id="categories"
      className="scroll-mt-28 rounded-card border border-border bg-card px-4 py-5 max-sm:px-3.5 max-sm:py-4 sm:px-6 sm:py-6"
    >
      <h2 className="text-xl font-extrabold tracking-tight text-foreground max-sm:text-lg sm:text-[1.375rem]">
        {copy.title}
      </h2>

      <div className="mt-5 w-full min-w-0 overflow-hidden rounded-card border border-border bg-card">
        <div className="w-full min-w-0">
          <div
            className={cn(sheetGridClass, 'hidden border-b border-border bg-surface px-4 py-2 text-[0.6875rem] font-bold uppercase tracking-wider text-muted sm:grid')}
            aria-hidden="true"
          >
            <span>{copy.columns.gender}</span>
            <span>{copy.columns.division}</span>
            <span>{copy.columns.age}</span>
            <span>{copy.columns.weights}</span>
          </div>

          {ageGroups.map((group) => (
            <section key={group.id} className="border-t border-border/90 first:border-t-0">
              <h3 className="bg-neutral-soft/85 px-4 py-2 pt-3 text-xs font-extrabold uppercase tracking-widest text-foreground">
                {group.label}
              </h3>
              <div className="flex flex-col">
                {group.divisions.map((division) => (
                  <DivisionRow key={division.id} division={division} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}
