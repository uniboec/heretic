import { describe, expect, it } from 'vitest'
import { resolvePublicBoutPlacement } from '../publicBoutPlacement'

describe('resolvePublicBoutPlacement', () => {
  it('marks finals and bronze bouts', () => {
    expect(resolvePublicBoutPlacement({ schedulePhase: 'final' })).toBe('final')
    expect(resolvePublicBoutPlacement({ schedulePhase: 'bronze' })).toBe('bronze')
  })

  it('ignores regular elimination bouts', () => {
    expect(resolvePublicBoutPlacement({ schedulePhase: 'elimination' })).toBeNull()
    expect(resolvePublicBoutPlacement({ schedulePhase: 'round_robin' })).toBeNull()
    expect(resolvePublicBoutPlacement({ schedulePhase: null })).toBeNull()
  })
})
