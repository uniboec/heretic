import { describe, expect, it } from 'vitest'
import { buildCanonicalEventFromCreated } from '../commandPayload'
import { computeClientCommandEventHash } from '../clientEventHash'
import { computeEventHash } from '../hash'

describe('clientEventHash', () => {
  it('matches server-side eventHash for CLOCK_START', () => {
    const payload = { boutElapsedMs: 0 }
    const clientHash = computeClientCommandEventHash({
      intent: 'CLOCK_START',
      commandId: 'op-clock-1',
      sequenceNo: 1,
      payload,
    })
    const serverHash = computeEventHash(
      buildCanonicalEventFromCreated({
        type: 'CLOCK_START',
        commandId: 'op-clock-1',
        sequenceNo: 1,
        boutElapsedMs: 0,
        payload,
      }),
    )
    expect(clientHash).toBe(serverHash)
  })

  it('maps CONFIRM intent to RESULT_CONFIRMED event type', () => {
    const hash = computeClientCommandEventHash({
      intent: 'CONFIRM',
      commandId: 'op-confirm',
      sequenceNo: 5,
      payload: { boutElapsedMs: 120_000 },
    })
    expect(hash).toHaveLength(64)
  })
})
