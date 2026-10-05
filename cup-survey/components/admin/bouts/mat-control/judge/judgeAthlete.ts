import { entryIdForCorner } from '@/lib/bouts/assertBoutParticipantCorner'
import { parseDisplayName } from '@/lib/awards/placements'
import type { BoutParticipantContext } from '@/lib/bouts/mat-control/types'
import type { Corner } from '@/lib/bouts/mat-control/types'
import type { InternalBout, InternalBoutSide } from '@/lib/bouts/types'

export function sideForUiCorner(
  corner: Corner,
  bout: InternalBout,
  participants: BoutParticipantContext,
): InternalBoutSide {
  const entryId = entryIdForCorner(corner, participants)
  if (bout.sideA.kind === 'athlete' && bout.sideA.entryId === entryId) {
    return bout.sideA
  }
  if (bout.sideB.kind === 'athlete' && bout.sideB.entryId === entryId) {
    return bout.sideB
  }
  return corner === 'red' ? bout.sideA : bout.sideB
}

export function sideLabel(side: InternalBoutSide): string {
  if (side.kind === 'athlete') return side.displayName
  if (side.kind === 'hint') return side.label
  return '—'
}

/** Фамилия и имя полностью, без отчества — для компактной очереди на ковре. */
export function formatJudgeQueueAthleteName(displayName: string): string {
  const { lastName, firstName } = parseDisplayName(displayName)
  return [lastName, firstName].filter(Boolean).join(' ')
}

export function sideMeta(side: InternalBoutSide): string {
  if (side.kind !== 'athlete') return ''
  const club = side.clubName?.trim()
  const city = side.city?.trim()
  if (club && city) return `${club} · ${city}`
  return club ?? city ?? ''
}

/** Split "Фамилия Имя Отчество" into surname (first token) and rest. */
export function splitAthleteName(displayName: string): { surname: string; given: string } {
  const parts = displayName.trim().split(/\s+/)
  if (parts.length <= 1) return { surname: displayName, given: '' }
  return { surname: parts[0], given: parts.slice(1).join(' ') }
}
