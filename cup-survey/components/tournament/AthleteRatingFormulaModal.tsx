'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal, modalContentEnter } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import type { AthleteRatingPublicFormula } from '@/lib/athleteRatings/types'
import { AthleteRatingFormulaHelp } from '@/components/tournament/AthleteRatingFormulaHelp'

const copy = tournamentPageCopy.athleteRatings

type AthleteRatingFormulaModalProps = {
  open: boolean
  onClose: () => void
  formula: AthleteRatingPublicFormula | null
  topLimit: number
  loading: boolean
}

export function AthleteRatingFormulaModal({
  open,
  onClose,
  formula,
  topLimit,
  loading,
}: AthleteRatingFormulaModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      panelClassName="flex max-h-[min(92dvh,48rem)] flex-col overflow-hidden"
      ariaLabelledBy="athlete-rating-formula-title"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 id="athlete-rating-formula-title" className="text-base font-semibold text-foreground">
          {copy.howItWorksTitle}
        </h2>
        <Button
          type="button"
          variant="ghost"
          className="h-8 w-8 shrink-0 p-0"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className={cn(modalContentEnter, 'overflow-y-auto px-4 py-4 sm:px-5')}>
        {loading ? (
          <p className="text-sm text-muted">{copy.loading}</p>
        ) : formula ? (
          <AthleteRatingFormulaHelp formula={formula} topLimit={topLimit} />
        ) : (
          <p className="text-sm text-muted">{copy.loadError}</p>
        )}
      </div>
    </Modal>
  )
}
