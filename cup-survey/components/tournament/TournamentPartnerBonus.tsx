import { withBasePath } from '@/lib/basePath'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { TournamentPartnerBlock } from './TournamentPartnerBlock'

const fightCrmLogoSrc = withBasePath('/partners/fight-crm-logo.png')

export function TournamentPartnerBonus() {
  return (
    <TournamentPartnerBlock
      id="partner-bonus"
      variant="fightcrm"
      copy={tournamentPageCopy.partnerBonus}
      logoSrc={fightCrmLogoSrc}
    />
  )
}
