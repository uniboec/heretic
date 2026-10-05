import { getSportRankLabel } from '../../../config/ranks'
import {
  getBracketRegion,
  earliestMeetingRound,
  formatRoundLabel,
  idealEarliestRound,
} from './bracketRegions'
import { bracketSizeForN } from './clubSeparation'
import { buildEarlyConflictVector } from './scoreAssignment'
import type { DrawAssignmentParticipant } from './scoreAssignment'
import type { DrawPolicyRef } from './drawPolicy'
import { getStrengthTierLabel } from './strengthTier'

export interface DrawBalanceSummary {
  clubLines: string[]
  cityLines: string[]
  strengthLines: string[]
  warnings: string[]
}

export interface OptimalLayoutMetrics {
  clubConflictVector: number[]
  clubEarlyConflictVector: number[]
  cityEarlyConflictVector: number[]
  strengthEarlyConflictVectorsByTier: Array<{ tier: number; label: string; conflictVector: number[] }>
}

export interface PotentialMeeting {
  kind: 'club' | 'city' | 'strength'
  groupKey: string
  entryIds: string[]
  meetingRound: number
  roundLabel: string
}

export interface EarlyConflict {
  kind: 'club' | 'city' | 'strength'
  groupKey: string
  entryIds: string[]
  meetingRound: number
  idealEarliestRound: number
  roundLabel: string
  message: string
}

export interface DrawBalanceReport {
  drawPolicyId: string
  drawPolicyVersion: number
  searchOptimal: boolean | null
  optimalLayoutMetrics?: OptimalLayoutMetrics
  currentPotentialMeetings: PotentialMeeting[]
  currentEarlyConflicts: EarlyConflict[]
  clubConflictVector: number[]
  cityConflictVector: number[]
  strengthDistribution: {
    byTier: Array<{ tier: number; label: string; placements: number[] }>
    notes: string[]
  }
  clubSeparation: {
    byClubKey: Array<{
      clubKey: string
      count: number
      regions: string[]
      conflictVector: number[]
    }>
    optimal: boolean | null
  }
  citySeparation: {
    byCityKey: Array<{
      cityKey: string
      count: number
      regions: string[]
      conflictVector: number[]
    }>
    optimal: boolean | null
  }
  strengthConflictVectorsByTier: Array<{
    tier: number
    label: string
    conflictVector: number[]
  }>
  summary: DrawBalanceSummary
}

function groupPairs(
  assignment: DrawAssignmentParticipant[],
  keySelector: (participant: DrawAssignmentParticipant) => string | null,
): Map<string, number[]> {
  const groups = new Map<string, number[]>()
  for (const participant of assignment) {
    const key = keySelector(participant)
    if (!key) continue
    const positions = groups.get(key) ?? []
    positions.push(participant.drawPosition)
    groups.set(key, positions)
  }
  return groups
}

function conflictVectorForGroup(positions: number[], bracketSize: number): number[] {
  const pairs: Array<{ posA: number; posB: number }> = []
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      pairs.push({ posA: positions[i], posB: positions[j] })
    }
  }
  const rounds = Math.log2(bracketSize)
  const vector = Array.from({ length: rounds }, () => 0)
  for (const pair of pairs) {
    vector[earliestMeetingRound(pair.posA, pair.posB, bracketSize) - 1] += 1
  }
  return vector
}

function collectMeetingsForGroup(input: {
  kind: 'club' | 'city' | 'strength'
  groupKey: string
  positions: number[]
  assignment: DrawAssignmentParticipant[]
  bracketSize: number
}): { potential: PotentialMeeting[]; early: EarlyConflict[] } {
  const potential: PotentialMeeting[] = []
  const early: EarlyConflict[] = []
  if (input.positions.length < 2) {
    return { potential, early }
  }

  const entryIds = input.assignment
    .filter((participant) => input.positions.includes(participant.drawPosition))
    .map((participant) => participant.entryId)
    .sort((a, b) => a.localeCompare(b))
  const ideal = idealEarliestRound(input.bracketSize, input.positions.length)
  const kindLabel =
    input.kind === 'club' ? 'Клуб' : input.kind === 'city' ? 'Город' : 'Разряд'
  const earlyRoundsSeen = new Set<number>()

  for (let i = 0; i < input.positions.length; i++) {
    for (let j = i + 1; j < input.positions.length; j++) {
      const meetingRound = earliestMeetingRound(
        input.positions[i],
        input.positions[j],
        input.bracketSize,
      )
      const roundLabel = formatRoundLabel(input.bracketSize, meetingRound)
      potential.push({
        kind: input.kind,
        groupKey: input.groupKey,
        entryIds,
        meetingRound,
        roundLabel,
      })
      if (meetingRound < ideal && !earlyRoundsSeen.has(meetingRound)) {
        earlyRoundsSeen.add(meetingRound)
        early.push({
          kind: input.kind,
          groupKey: input.groupKey,
          entryIds,
          meetingRound,
          idealEarliestRound: ideal,
          roundLabel,
          message: `⚠ ${kindLabel} ${input.groupKey}: встреча раньше ${formatRoundLabel(input.bracketSize, ideal)}`,
        })
      }
    }
  }

  return { potential, early }
}

export function buildDrawBalanceReport(input: {
  assignment: DrawAssignmentParticipant[]
  searchOptimal: boolean | null
  policy: DrawPolicyRef
}): DrawBalanceReport {
  const participantCount = input.assignment.length
  const bracketSize = bracketSizeForN(participantCount)
  const clubGroups = groupPairs(input.assignment, (participant) => participant.clubKey)
  const cityGroups = groupPairs(input.assignment, (participant) => participant.cityKey)

  const clubConflictVector = Array.from({ length: Math.log2(bracketSize) }, () => 0)
  const cityConflictVector = Array.from({ length: Math.log2(bracketSize) }, () => 0)

  const clubByKey = [...clubGroups.entries()].map(([clubKey, positions]) => {
    const vector = conflictVectorForGroup(positions, bracketSize)
    for (let index = 0; index < vector.length; index++) {
      clubConflictVector[index] += vector[index]
    }
    const regions = positions.map(
      (position) => `H${getBracketRegion(position, bracketSize).half}/Q${getBracketRegion(position, bracketSize).quarter}`,
    )
    return { clubKey, count: positions.length, regions, conflictVector: vector }
  })

  const cityByKey = [...cityGroups.entries()].map(([cityKey, positions]) => {
    const vector = conflictVectorForGroup(positions, bracketSize)
    for (let index = 0; index < vector.length; index++) {
      cityConflictVector[index] += vector[index]
    }
    const regions = positions.map(
      (position) => `H${getBracketRegion(position, bracketSize).half}`,
    )
    return { cityKey, count: positions.length, regions, conflictVector: vector }
  })

  const tiers = [
    ...new Set(
      input.assignment
        .map((participant) => participant.strengthTier)
        .filter((tier): tier is number => tier != null),
    ),
  ].sort((a, b) => b - a)

  const strengthConflictVectorsByTier = tiers.map((tier) => {
    const positions = input.assignment
      .filter((participant) => participant.strengthTier === tier)
      .map((participant) => participant.drawPosition)
    return {
      tier,
      label: getSportRankLabel(getStrengthTierLabel(tier)),
      conflictVector: conflictVectorForGroup(positions, bracketSize),
    }
  })

  const currentPotentialMeetings: PotentialMeeting[] = []
  const currentEarlyConflicts: EarlyConflict[] = []

  for (const [clubKey, positions] of clubGroups) {
    const meetings = collectMeetingsForGroup({
      kind: 'club',
      groupKey: clubKey,
      positions,
      assignment: input.assignment,
      bracketSize,
    })
    currentPotentialMeetings.push(...meetings.potential)
    currentEarlyConflicts.push(...meetings.early)
  }

  for (const [cityKey, positions] of cityGroups) {
    const meetings = collectMeetingsForGroup({
      kind: 'city',
      groupKey: cityKey,
      positions,
      assignment: input.assignment,
      bracketSize,
    })
    currentPotentialMeetings.push(...meetings.potential)
    currentEarlyConflicts.push(...meetings.early)
  }

  for (const tier of strengthConflictVectorsByTier) {
    const positions = input.assignment
      .filter((participant) => participant.strengthTier === tier.tier)
      .map((participant) => participant.drawPosition)
    const meetings = collectMeetingsForGroup({
      kind: 'strength',
      groupKey: tier.label,
      positions,
      assignment: input.assignment,
      bracketSize,
    })
    currentPotentialMeetings.push(...meetings.potential)
    currentEarlyConflicts.push(...meetings.early)
  }

  const warnings: string[] = []
  for (const club of clubByKey) {
    if (club.count < 2) continue
    const pairs: Array<{ posA: number; posB: number }> = []
    const positions = clubGroups.get(club.clubKey) ?? []
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        pairs.push({ posA: positions[i], posB: positions[j] })
      }
    }
    const early = buildEarlyConflictVector(pairs, bracketSize, club.count)
    const earlyCount = early.reduce((sum, value) => sum + value, 0)
    if (earlyCount > 0) {
      warnings.push(`Клуб ${club.clubKey}: остаётся ${earlyCount} ранних встреч`)
    }
  }

  const clubLines = clubByKey
    .filter((club) => club.count >= 2)
    .map((club) => `Клуб ${club.clubKey} — ${club.count} спортсмена`)

  const cityLines = cityByKey
    .filter((city) => city.count >= 2)
    .map((city) => `Город ${city.cityKey} — ${city.count} спортсмена`)

  const strengthLines = strengthConflictVectorsByTier.map(
    (tier) => `Разряд ${tier.label} — ${tier.conflictVector.reduce((sum, value) => sum + value, 0)} потенциальных встреч`,
  )

  let optimalLayoutMetrics: OptimalLayoutMetrics | undefined
  if (input.searchOptimal === true) {
    const clubEarlyPairs: Array<{ posA: number; posB: number }> = []
    for (const club of clubByKey) {
      if (club.count < 2) continue
      const positions = clubGroups.get(club.clubKey) ?? []
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          clubEarlyPairs.push({ posA: positions[i], posB: positions[j] })
        }
      }
    }
    const cityEarlyPairs: Array<{ posA: number; posB: number }> = []
    for (const city of cityByKey) {
      if (city.count < 2) continue
      const positions = cityGroups.get(city.cityKey) ?? []
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          cityEarlyPairs.push({ posA: positions[i], posB: positions[j] })
        }
      }
    }
    optimalLayoutMetrics = {
      clubConflictVector,
      clubEarlyConflictVector: buildEarlyConflictVector(clubEarlyPairs, bracketSize, 2),
      cityEarlyConflictVector: buildEarlyConflictVector(cityEarlyPairs, bracketSize, 2),
      strengthEarlyConflictVectorsByTier: strengthConflictVectorsByTier.map((tier) => {
        const positions = input.assignment
          .filter((participant) => participant.strengthTier === tier.tier)
          .map((participant) => participant.drawPosition)
        const pairs: Array<{ posA: number; posB: number }> = []
        for (let i = 0; i < positions.length; i++) {
          for (let j = i + 1; j < positions.length; j++) {
            pairs.push({ posA: positions[i], posB: positions[j] })
          }
        }
        return {
          tier: tier.tier,
          label: tier.label,
          conflictVector: buildEarlyConflictVector(pairs, bracketSize, positions.length),
        }
      }),
    }
  }

  return {
    drawPolicyId: input.policy.drawPolicyId,
    drawPolicyVersion: input.policy.drawPolicyVersion,
    searchOptimal: input.searchOptimal,
    optimalLayoutMetrics,
    clubConflictVector,
    cityConflictVector,
    strengthDistribution: {
      byTier: strengthConflictVectorsByTier.map((tier) => ({
        tier: tier.tier,
        label: tier.label,
        placements: input.assignment
          .filter((participant) => participant.strengthTier === tier.tier)
          .map((participant) => participant.drawPosition),
      })),
      notes: strengthLines,
    },
    clubSeparation: {
      byClubKey: clubByKey,
      optimal: input.searchOptimal,
    },
    citySeparation: {
      byCityKey: cityByKey,
      optimal: input.searchOptimal,
    },
    strengthConflictVectorsByTier,
    currentPotentialMeetings,
    currentEarlyConflicts,
    summary: {
      clubLines,
      cityLines,
      strengthLines,
      warnings,
    },
  }
}

export function summarizeReport(report: DrawBalanceReport): DrawBalanceSummary {
  return report.summary
}

export interface BalanceDelta {
  before: DrawBalanceSummary
  after: DrawBalanceSummary
  lines: string[]
}
