import { describe, expect, it } from 'vitest'
import {
  countPublicBoutsByCompletion,
  isPublicBoutCompleted,
  matchesPublicBoutCompletionMode,
} from '../publicBoutCompletion'

describe('publicBoutCompletion', () => {
  const completed = { timing: { status: 'completed' as const } }
  const active = { timing: { status: 'in_progress' as const } }
  const scheduled = { timing: { status: 'upcoming' as const } }

  it('detects completed bouts from timing status', () => {
    expect(isPublicBoutCompleted(completed)).toBe(true)
    expect(isPublicBoutCompleted(active)).toBe(false)
    expect(isPublicBoutCompleted(scheduled)).toBe(false)
    expect(isPublicBoutCompleted({})).toBe(false)
  })

  it('filters bouts by completion mode', () => {
    expect(matchesPublicBoutCompletionMode(completed, 'active')).toBe(false)
    expect(matchesPublicBoutCompletionMode(completed, 'completed')).toBe(true)
    expect(matchesPublicBoutCompletionMode(completed, 'all')).toBe(true)
    expect(matchesPublicBoutCompletionMode(active, 'active')).toBe(true)
    expect(matchesPublicBoutCompletionMode(active, 'completed')).toBe(false)
  })

  it('counts bouts by completion', () => {
    expect(countPublicBoutsByCompletion([completed, active, scheduled])).toEqual({
      active: 2,
      completed: 1,
      all: 3,
    })
  })
})
