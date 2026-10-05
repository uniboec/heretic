import { TournamentShell } from '@/components/tournament/TournamentShell'
import { loadTournamentShellState } from '@/lib/tournament/shellState'

export default async function EventLayout({ children }: { children: React.ReactNode }) {
  const initialState = await loadTournamentShellState()

  return <TournamentShell initialState={initialState}>{children}</TournamentShell>
}
