import type { BracketStructure, SystemBuildInput, ValidationIssue } from '../../../core/types'

export function buildChampionV1(input: SystemBuildInput): BracketStructure {
  const participant = input.participants[0]
  if (!participant) {
    return {
      systemId: 'champion',
      systemVersion: 1,
      rounds: [],
      result: { status: 'in_progress', placements: [] },
    }
  }

  return {
    systemId: 'champion',
    systemVersion: 1,
    rounds: [],
    label: 'Победитель категории',
    champion: {
      entryId: participant.entryId,
      displayName: participant.displayName,
      clubName: participant.clubName,
      city: participant.city,
      publicNumber: participant.publicNumber,
    },
    result: {
      status: 'complete',
      placements: [
        {
          entryId: participant.entryId,
          placement: 1,
          reason: 'SINGLE_PARTICIPANT',
        },
      ],
    },
  }
}

export function validateChampionCategory(n: number): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (n !== 1) {
    issues.push({ code: 'INVALID_PARTICIPANT_COUNT', message: 'Система «Чемпион» только для 1 участника' })
  }
  return issues
}
