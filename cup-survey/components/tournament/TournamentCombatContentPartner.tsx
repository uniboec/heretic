import { withBasePath } from '@/lib/basePath'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { TournamentPartnerBlock } from './TournamentPartnerBlock'

const combatContentLogoSrc = withBasePath('/partners/combat-content-brand.jpg')

export function TournamentCombatContentPartner() {
  return (
    <TournamentPartnerBlock
      id="partner-combat-content"
      variant="combatcontent"
      copy={tournamentPageCopy.combatContentPartner}
      logoSrc={combatContentLogoSrc}
    />
  )
}
