import { describe, expect, it } from 'vitest'
import { assertCategorySyncAllowed } from '../core/syncGuards'
import { BracketOperationError } from '../core/errors'

describe('assertCategorySyncAllowed', () => {
  it('allows category sync when revision matches', () => {
    expect(() =>
      assertCategorySyncAllowed('category', BigInt(5), BigInt(5)),
    ).not.toThrow()
  })

  it('allows category sync when sourceRevision is null', () => {
    expect(() => assertCategorySyncAllowed('category', null, BigInt(5))).not.toThrow()
  })

  it('allows scope=all even when revision mismatches', () => {
    expect(() => assertCategorySyncAllowed('all', BigInt(5), BigInt(6))).not.toThrow()
  })

  it('throws GLOBAL_SYNC_REQUIRED on revision mismatch', () => {
    expect(() => assertCategorySyncAllowed('category', BigInt(5), BigInt(6))).toThrow(
      BracketOperationError,
    )
    try {
      assertCategorySyncAllowed('category', BigInt(5), BigInt(6))
    } catch (e) {
      expect((e as BracketOperationError).code).toBe('GLOBAL_SYNC_REQUIRED')
    }
  })
})
