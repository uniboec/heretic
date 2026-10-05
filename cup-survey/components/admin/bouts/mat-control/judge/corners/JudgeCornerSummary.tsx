'use client'

import type { InternalBoutSide } from '@/lib/bouts/types'
import { JudgeCornerColumn } from '../JudgeCornerColumn'
import type { CornerNextSanctions } from '@/lib/bouts/buildNextSanctions'
import type { PenaltySanction } from '@/lib/config/fseRules'
import type { MandateWarning } from '@/lib/mandate/types'

export function JudgeCornerSummary({
  corner,
  side,
  score,
  scoreLabel,
  scoreContext,
  verificationWarnings,
  mandateAthleteId,
}: {
  corner: 'red' | 'blue'
  side: InternalBoutSide
  score: number
  scoreLabel?: string
  scoreContext?: string
  verificationWarnings?: MandateWarning[]
  mandateAthleteId?: string | null
}) {
  const emptySanctions: CornerNextSanctions = {
    general: 'WARNING_1',
    outOfBounds: 'WARNING_1',
    passivity: 'WARNING_1',
  }

  return (
    <JudgeCornerColumn
      corner={corner}
      side={side}
      score={score}
      scoreLabel={scoreLabel}
      scoreContext={scoreContext}
      cornerMode="summary"
      generalSanction={null as PenaltySanction | null}
      outOfBoundsSanction={null}
      passivitySanction={null}
      nextSanctions={emptySanctions}
      controlsEnabled={false}
      showScoring={false}
      passivityActive={false}
      onScore={() => {}}
      onPenaltyNext={() => {}}
      onDisqualify={() => {}}
      onPassivity={() => {}}
      verificationWarnings={verificationWarnings}
      mandateAthleteId={mandateAthleteId}
    />
  )
}
