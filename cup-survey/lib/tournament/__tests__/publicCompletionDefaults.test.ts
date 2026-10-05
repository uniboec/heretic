import { describe, expect, it } from 'vitest'
import {
  defaultPublicAwardsTab,
  defaultPublicCompletionMode,
} from '../publicCompletionDefaults'

describe('publicCompletionDefaults', () => {
  it('opens completed when nothing active remains', () => {
    expect(defaultPublicCompletionMode({ active: 0, completed: 5 })).toBe('completed')
    expect(defaultPublicAwardsTab({ queueCount: 0, completedCount: 3 })).toBe('completed')
  })

  it('keeps active/queue while work remains', () => {
    expect(defaultPublicCompletionMode({ active: 2, completed: 10 })).toBe('active')
    expect(defaultPublicAwardsTab({ queueCount: 1, completedCount: 5 })).toBe('queue')
  })

  it('defaults to active/queue when both empty', () => {
    expect(defaultPublicCompletionMode({ active: 0, completed: 0 })).toBe('active')
    expect(defaultPublicAwardsTab({ queueCount: 0, completedCount: 0 })).toBe('queue')
  })
})
