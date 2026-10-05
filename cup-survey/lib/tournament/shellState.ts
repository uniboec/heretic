import { getAwardsPageSettings } from '@/lib/awards/settings'
import { getBracketPageSettings } from '@/lib/brackets/service'
import { getBoutsPageSettings } from '@/lib/bouts/service'
import { getNormQualificationsVisibility } from '@/lib/rankQualifications/visibility'
import { getPublicParticipantStats } from '@/lib/registration/service'
import { getServerNow, isRegistrationClosed } from '@/lib/registration/time'

export type TournamentShellState = {
  entryCount: number
  closed: boolean
  bracketsPublicEnabled: boolean
  boutsPublicEnabled: boolean
  awardsPublicEnabled: boolean
  normQualificationsPublicEnabled: boolean
}

export async function loadTournamentShellState(): Promise<TournamentShellState> {
  const closed = isRegistrationClosed(getServerNow())
  let entryCount = 0
  let bracketsPublicEnabled = false
  let boutsPublicEnabled = false
  let awardsPublicEnabled = false
  let normQualificationsPublicEnabled = false

  try {
    const stats = await getPublicParticipantStats()
    entryCount = stats.entries
    bracketsPublicEnabled = (await getBracketPageSettings()).publicEnabled
    boutsPublicEnabled = (await getBoutsPageSettings()).publicEnabled
    awardsPublicEnabled = (await getAwardsPageSettings()).publicEnabled
    const normVisibility = await getNormQualificationsVisibility()
    normQualificationsPublicEnabled = normVisibility.normQualificationsPublicEnabled
  } catch (error) {
    console.error('loadTournamentShellState: database unavailable', error)
  }

  return {
    entryCount,
    closed,
    bracketsPublicEnabled,
    boutsPublicEnabled,
    awardsPublicEnabled,
    normQualificationsPublicEnabled,
  }
}
