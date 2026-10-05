'use client'

import { BRACKET_WORKFLOW_STEPS } from '@/lib/brackets/labels'
import {
  getWorkflowStepHint,
  getWorkflowStepStates,
  type WorkflowStepState,
} from '@/lib/brackets/admin/workflow'
import { cn } from '@/lib/cn'

interface AdminBracketWorkflowStatusBarProps {
  globalCompositionStale: boolean
  registrationDataStale: boolean
  eligibilityCriteriaStale: boolean
  staleRedrawCount: number
  controlsEnabled: boolean
  publicVisibleCount: number
  boutsReleasedCount: number
  independentBoutsRelease: boolean
  categoryCount: number
}

const workflowStepBase =
  'grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 rounded-[0.875rem] border border-border bg-background-soft p-3'
const workflowStepIndex =
  'inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-xs font-bold'

function stepClasses(state: WorkflowStepState): string {
  switch (state) {
    case 'complete':
      return 'border-success-border/35 bg-success-soft'
    case 'active':
      return 'border-accent/35 bg-accent-soft/40 shadow-[0_0_0_1px_rgb(from_var(--color-accent)_r_g_b/0.08)]'
    case 'blocked':
      return 'opacity-72'
    default:
      return ''
  }
}

function stepStateClasses(state: WorkflowStepState): string {
  switch (state) {
    case 'complete':
      return 'text-success-foreground'
    case 'active':
      return 'text-accent'
    default:
      return 'text-muted'
  }
}

function stepLabel(state: WorkflowStepState, optional?: boolean): string {
  if (optional) return 'Необяз.'
  switch (state) {
    case 'complete':
      return 'Готово'
    case 'active':
      return 'Сейчас'
    case 'blocked':
      return 'Ждёт'
    default:
      return 'Далее'
  }
}

export function AdminBracketWorkflowStatusBar(props: AdminBracketWorkflowStatusBarProps) {
  const states = getWorkflowStepStates(props)
  const activeHint = BRACKET_WORKFLOW_STEPS.map((step) =>
    getWorkflowStepHint(step.id, states[step.id]),
  ).find(Boolean)

  return (
    <div className="grid gap-3">
      <ol className="m-0 grid list-none gap-3 p-0 min-[960px]:grid-cols-4">
        {BRACKET_WORKFLOW_STEPS.map((step, index) => {
          const state = states[step.id]
          const optional = 'optional' in step && Boolean(step.optional)
          const displayIndex = BRACKET_WORKFLOW_STEPS.slice(0, index + 1).filter(
            (item) => !('optional' in item && item.optional),
          ).length
          return (
            <li key={step.id} className="relative min-w-0">
              <div className={cn(workflowStepBase, stepClasses(state))}>
                <span className={workflowStepIndex}>{optional ? '·' : displayIndex}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{step.label}</p>
                  <p className="mt-0.5 text-[0.6875rem] leading-snug text-muted">{step.description}</p>
                </div>
                <span
                  className={cn(
                    'text-[0.6875rem] font-bold uppercase tracking-wide',
                    stepStateClasses(state),
                  )}
                >
                  {stepLabel(state, optional)}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
      {activeHint && <p className="text-[0.8125rem] text-muted">{activeHint}</p>}
    </div>
  )
}
