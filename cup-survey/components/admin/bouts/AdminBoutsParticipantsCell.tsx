'use client'

import type { BoutSideData } from '@/components/tournament/BoutCard'
import {
  adminBoutsParticipantClub,
  adminBoutsParticipantName,
  adminBoutsParticipantRow,
  adminBoutsParticipantsCell,
} from '@/lib/ui/adminSurfaceStyles'

function formatSideName(side: BoutSideData): string {
  if (side.kind === 'athlete') return side.displayName || '—'
  return side.label || '—'
}

function formatSideTitle(side: BoutSideData): string {
  const parts = [formatSideName(side), side.clubName?.trim(), side.city?.trim()].filter(Boolean)
  return parts.join(' · ')
}

interface AdminBoutsParticipantsCellProps {
  sideA: BoutSideData
  sideB: BoutSideData
}

export function AdminBoutsParticipantsCell({ sideA, sideB }: AdminBoutsParticipantsCellProps) {
  return (
    <div className={adminBoutsParticipantsCell}>
      {[sideA, sideB].map((side, index) => (
        <p key={index} className={adminBoutsParticipantRow} title={formatSideTitle(side)}>
          <span className={adminBoutsParticipantName}>{formatSideName(side)}</span>
          {side.clubName ? (
            <span className={adminBoutsParticipantClub}>{side.clubName}</span>
          ) : null}
        </p>
      ))}
    </div>
  )
}
