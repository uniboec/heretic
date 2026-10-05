import { tournamentPageCopy } from '@/lib/content/tournament-page'
import {
  formatPlaceWithoutWinsPoints,
  type AthleteRatingPublicFormula,
} from '@/lib/athleteRatings/publicFormula'

const copy = tournamentPageCopy.athleteRatings.howItWorks
const victoryLabels = tournamentPageCopy.athleteRatings.settings.victoryPoints

type AthleteRatingFormulaHelpProps = {
  formula: AthleteRatingPublicFormula
  topLimit: number
}

export function AthleteRatingFormulaHelp({ formula, topLimit }: AthleteRatingFormulaHelpProps) {
  const { placePoints, placeWithoutWinPercent, victoryPoints, ageCoefficients } = formula

  const victoryRows = [
    { label: victoryLabels.pointsVictoryPoints, value: victoryPoints.pointsVictoryPoints },
    { label: victoryLabels.clearAdvantageVictoryPoints, value: victoryPoints.clearAdvantageVictoryPoints },
    { label: victoryLabels.submissionVictoryPoints, value: victoryPoints.submissionVictoryPoints },
    { label: victoryLabels.chokeVictoryPoints, value: victoryPoints.chokeVictoryPoints },
    { label: victoryLabels.injuryVictoryPoints, value: victoryPoints.injuryVictoryPoints },
    { label: victoryLabels.dqVictoryPoints, value: victoryPoints.dqVictoryPoints },
  ]

  const placeWithoutWinExamples = [
    {
      place: copy.placeLabels.first,
      points: placePoints.first,
      result: formatPlaceWithoutWinsPoints(placePoints.first, placeWithoutWinPercent),
    },
    {
      place: copy.placeLabels.second,
      points: placePoints.second,
      result: formatPlaceWithoutWinsPoints(placePoints.second, placeWithoutWinPercent),
    },
    {
      place: copy.placeLabels.third,
      points: placePoints.third,
      result: formatPlaceWithoutWinsPoints(placePoints.third, placeWithoutWinPercent),
    },
  ]

  return (
    <div className="space-y-5 text-sm leading-relaxed text-muted">
      <p>{copy.intro}</p>

      <section className="space-y-2">
        <h3 className="font-semibold text-foreground">{copy.formulaTitle}</h3>
        <p>{copy.formulaDiscipline}</p>
        <p className="rounded-lg border border-border/70 bg-background-soft/40 px-3 py-2 font-mono text-xs text-foreground">
          {copy.formulaDisciplineExpression}
        </p>
        <p>{copy.formulaOverall}</p>
        <p className="rounded-lg border border-border/70 bg-background-soft/40 px-3 py-2 font-mono text-xs text-foreground">
          {copy.formulaOverallExpression}
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-foreground">{copy.placePointsTitle}</h3>
        <p>{copy.placeWithWinsDescription}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{copy.placeLabels.first}: {placePoints.first}</li>
          <li>{copy.placeLabels.second}: {placePoints.second}</li>
          <li>{copy.placeLabels.third}: {placePoints.third}</li>
        </ul>
        <p>
          {copy.placeWithoutWinsDescription(placeWithoutWinPercent)}
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {placeWithoutWinExamples.map((example) => (
            <li key={example.place}>
              {example.place}: {example.points} × {placeWithoutWinPercent}% = {example.result}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-foreground">{copy.victoryPointsTitle}</h3>
        <p>{copy.victoryPointsDescription}</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {victoryRows.map((row) => (
            <li key={row.label}>
              {row.label}: <span className="font-medium text-foreground">{row.value}</span>
            </li>
          ))}
        </ul>
        <p>{copy.forfeitNote}</p>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-foreground">{copy.ageCoefficientsTitle}</h3>
        <p>{copy.ageCoefficientsDescription}</p>
        <p className="rounded-lg border border-border/70 bg-background-soft/40 px-3 py-2 font-mono text-xs text-foreground">
          {copy.ageCoefficientsExpression}
        </p>
        <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
          {ageCoefficients.map((row) => (
            <li key={row.bracketLabel}>
              {row.bracketLabel}:{' '}
              <span className="font-medium text-foreground">{row.percent}%</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-foreground">{copy.notesTitle}</h3>
        <ul className="list-disc space-y-1 pl-5">
          {copy.notes(topLimit).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
