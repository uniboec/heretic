'use client'

import { tournamentPageCopy } from '@/lib/content/tournament-page'
import type { PublicBoutCompletionMode } from '@/lib/bouts/publicBoutCompletion'
import { PublicSegmentedFilter } from '@/components/tournament/PublicSegmentedFilter'

const copy = tournamentPageCopy.bouts

export function PublicBoutCompletionSwitch({
  mode,
  counts,
  onChange,
}: {
  mode: PublicBoutCompletionMode
  counts: { active: number; completed: number; all: number }
  onChange: (mode: PublicBoutCompletionMode) => void
}) {
  return (
    <PublicSegmentedFilter
      label={copy.filterStatusLabel}
      ariaLabel={copy.completionLabel}
      value={mode}
      onChange={onChange}
      options={[
        { value: 'active', label: copy.completionActive, count: counts.active },
        { value: 'completed', label: copy.completionCompleted, count: counts.completed },
        { value: 'all', label: copy.completionAll, count: counts.all },
      ]}
    />
  )
}
