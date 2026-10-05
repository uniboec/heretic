import { TournamentPage } from '@/components/tournament/TournamentPage'
import { loadTournamentPageState } from '@/lib/tournament/pageState'
import { registrationClosesAt } from '@/lib/config/tournament'

export default async function HomePage() {
  let initialState

  try {
    initialState = await loadTournamentPageState()
  } catch (error) {
    console.error('HomePage: failed to load tournament page state', error)
    initialState = {
      closed: true,
      registrationClosesAt,
      stage: null,
      stages: [],
      stats: { athletes: 0, clubs: 0, tacticControl: 0, closeControl: 0, entries: 0 },
      publicDiscounts: [],
    }
  }

  return <TournamentPage initialState={initialState} />
}
