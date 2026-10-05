import { describe, expect, it } from 'vitest'
import {
  canonicalizeMutationPayload,
  computeScheduleMutationFingerprint,
} from '../scheduleMutation'

describe('scheduleMutation', () => {
  it('builds stable fingerprints from canonical payload', () => {
    const left = computeScheduleMutationFingerprint({
      mutationId: '11111111-1111-4111-8111-111111111111',
      boutId: 'cat::bout-1',
      command: 'START',
      payload: { matIndex: 1, nested: { b: 2, a: 1 } },
    })
    const right = computeScheduleMutationFingerprint({
      mutationId: '11111111-1111-4111-8111-111111111111',
      boutId: 'cat::bout-1',
      command: 'START',
      payload: { nested: { a: 1, b: 2 }, matIndex: 1 },
    })
    expect(left).toBe(right)
  })

  it('changes fingerprint when payload changes', () => {
    const base = computeScheduleMutationFingerprint({
      mutationId: '11111111-1111-4111-8111-111111111111',
      boutId: 'cat::bout-1',
      command: 'START',
      payload: { matIndex: 1 },
    })
    const other = computeScheduleMutationFingerprint({
      mutationId: '11111111-1111-4111-8111-111111111111',
      boutId: 'cat::bout-2',
      command: 'START',
      payload: { matIndex: 1 },
    })
    expect(base).not.toBe(other)
  })

  it('canonicalizes nested objects', () => {
    expect(canonicalizeMutationPayload({ z: 1, a: { c: 3, b: 2 } })).toEqual({
      a: { b: 2, c: 3 },
      z: 1,
    })
  })
})
