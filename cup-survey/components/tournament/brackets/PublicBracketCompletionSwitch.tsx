'use client'

import { tournamentPageCopy } from '@/lib/content/tournament-page'
import type { PublicBracketCompletionMode } from '@/lib/brackets/publicCategoryFilters'
import { PublicSegmentedFilter } from '@/components/tournament/PublicSegmentedFilter'

const copy = tournamentPageCopy.brackets

export function PublicBracketCompletionSwitch({
  mode,
  counts,
  onChange,
}: {
  mode: PublicBracketCompletionMode
  counts: { active: number; completed: number; all: number }
  onChange: (mode: PublicBracketCompletionMode) => void
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
