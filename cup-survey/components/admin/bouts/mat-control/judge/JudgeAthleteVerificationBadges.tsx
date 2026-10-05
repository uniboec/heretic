'use client'

import { StatusBadge } from '@/components/ui/StatusBadge'
import { buildMandateCommissionAthleteUrl } from '@/lib/mandate/mandateCommissionUrl'
import type { MandateWarning } from '@/lib/mandate/types'

type JudgeAthleteVerificationBadgesProps = {
  warnings: MandateWarning[]
  athleteId?: string | null
}

function warningTone(code: MandateWarning['code']): 'warning' | 'danger' | 'amber' {
  if (code.startsWith('PAYMENT_') || code.startsWith('WEIGHT_')) return 'danger'
  if (code.endsWith('_ISSUE')) return 'danger'
  return 'amber'
}

export function JudgeAthleteVerificationBadges({
  warnings,
  athleteId,
}: JudgeAthleteVerificationBadgesProps) {
  if (warnings.length === 0) return null

  return (
    <div className="mt-2 space-y-1">
      {warnings.map((warning) => (
        <div
          key={`${warning.code}-${warning.message.slice(0, 24)}`}
          className="flex flex-wrap items-start gap-x-2 gap-y-0.5"
        >
          <StatusBadge
            tone={warningTone(warning.code)}
            appearance="chip"
            className="whitespace-pre-wrap text-left text-[11px] leading-snug"
          >
            {warning.message}
          </StatusBadge>
          {athleteId ? (
            <a
              href={buildMandateCommissionAthleteUrl(athleteId)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[10px] font-semibold text-accent underline-offset-2 hover:underline"
            >
              Допуск
            </a>
          ) : null}
        </div>
      ))}
    </div>
  )
}
