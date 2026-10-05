import { buildDrawBalanceReport, type DrawBalanceReport } from '../core/seeding/drawBalanceReport'
import { getDefaultDrawPolicy } from '../core/seeding/drawPolicy'

export function computeCategoryDrawBalance(
  participants: Array<{
    entryId: string
    seedPosition: number
    seedLocked: boolean
    clubKey?: string | null
    cityKey?: string | null
    strengthTier?: number | null
  }>,
): DrawBalanceReport | null {
  if (participants.length < 2) return null

  return buildDrawBalanceReport({
    assignment: participants.map((participant) => ({
      entryId: participant.entryId,
      strengthTier: participant.strengthTier ?? null,
      clubKey: participant.clubKey ?? null,
      cityKey: participant.cityKey ?? null,
      drawPosition: participant.seedPosition,
      seedLocked: participant.seedLocked,
    })),
    searchOptimal: null,
    policy: getDefaultDrawPolicy(),
  })
}

export function getParticipantClubConflictHint(
  participant: { clubKey?: string | null },
  report: DrawBalanceReport | null,
  participantCount: number,
): string | null {
  if (!report || !participant.clubKey) return null

  const club = report.clubSeparation.byClubKey.find(
    (item) => item.clubKey === participant.clubKey && item.count >= 2,
  )
  if (!club) return null

  const earlyConflicts = club.conflictVector
    .slice(0, Math.max(1, Math.ceil(Math.log2(Math.max(participantCount, 2))) - 1))
    .reduce((sum, value) => sum + value, 0)

  if (earlyConflicts <= 0) return null
  return `Клуб: ${earlyConflicts} ранних встреч`
}
