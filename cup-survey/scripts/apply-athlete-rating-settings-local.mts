import {
  getAthleteRatingSettings,
  updateAthleteRatingSettings,
} from '../lib/athleteRatings/settings.ts'

const current = await getAthleteRatingSettings()

const updated = await updateAthleteRatingSettings({
  publicEnabled: current.publicEnabled,
  publicTopLimit: current.publicTopLimit,
  firstPlacePoints: 40,
  secondPlacePoints: 14,
  thirdPlacePoints: 7,
  placeWithoutWinPercent: 3,
  pointsVictoryPoints: 30,
  clearAdvantageVictoryPoints: 34,
  submissionVictoryPoints: 40,
  chokeVictoryPoints: 40,
  injuryVictoryPoints: 14,
  dqVictoryPoints: 6,
  ageCoefficients: {
    '4-5': 80,
    '6-7': 85,
    '8-9': 90,
    '10-11': 94,
    '12-13': 97,
    '14-15': 100,
    '16-17': 101,
    '18+': 101,
  },
})

console.log('Athlete rating settings updated:')
console.log(JSON.stringify(updated, null, 2))

const { getAdminAthleteRatings } = await import('../lib/athleteRatings/service.ts')
const { rows } = await getAdminAthleteRatings('overall')
console.log('\nTop 5:')
for (const row of rows.filter((item) => item.rank != null && item.rank <= 5)) {
  console.log(
    `${row.rank}. ${row.displayName} — ${row.ratingFormatted} | побед ${row.wins} | ${row.placementSummary}`,
  )
}
