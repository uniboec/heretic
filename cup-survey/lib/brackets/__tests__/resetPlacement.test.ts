import { describe, expect, it } from 'vitest'
import { categoryFingerprintForDraw } from '../core/fingerprint'

describe('reset placement fingerprints', () => {
  it('updates source category fingerprint after return', () => {
    const before = categoryFingerprintForDraw('cat-a', ['e2'])
    const after = categoryFingerprintForDraw('cat-a', ['e2', 'e1'])
    expect(before).not.toBe(after)
  })

  it('clears manual move from generation-level comparison via source keys', () => {
    const sourceOnly = categoryFingerprintForDraw('cat-a', ['e1'])
    const movedDraw = categoryFingerprintForDraw('cat-b', ['e1'])
    expect(sourceOnly).not.toBe(movedDraw)
  })
})
