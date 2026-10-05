import { describe, expect, it } from 'vitest'
import { buildMandatePatchData } from '../patchMandateCheck'

const existing = {
  medicalStatus: 'UNCHECKED' as const,
  insuranceStatus: 'UNCHECKED' as const,
  documentsStatus: 'UNCHECKED' as const,
  weightCheckMode: null,
  actualWeightKg: null,
  manualWeightVerified: false,
  manualWeightCategoryFingerprint: null,
  comment: null,
}

describe('buildMandatePatchData weight modes', () => {
  it('stores AUTO mode and clears manual flags when weight is entered', () => {
    const data = buildMandatePatchData({
      patch: { actualWeightKg: 55 },
      existing,
      serverCategoryFingerprint: 'cat-a',
    })

    expect(data).toEqual({
      weightCheckMode: 'AUTO',
      actualWeightKg: 55,
      manualWeightVerified: false,
      manualWeightCategoryFingerprint: null,
    })
  })

  it('stores MANUAL mode when organizer confirms OK without weight', () => {
    const data = buildMandatePatchData({
      patch: { manualWeightVerified: true },
      existing,
      serverCategoryFingerprint: 'cat-a|cat-b',
    })

    expect(data).toEqual({
      weightCheckMode: 'MANUAL',
      actualWeightKg: null,
      manualWeightVerified: true,
      manualWeightCategoryFingerprint: 'cat-a|cat-b',
    })
  })

  it('stores MANUAL_ISSUE when organizer marks issue without weight', () => {
    const data = buildMandatePatchData({
      patch: { manualWeightIssue: true },
      existing,
      serverCategoryFingerprint: 'cat-a',
    })

    expect(data).toEqual({
      weightCheckMode: 'MANUAL_ISSUE',
      actualWeightKg: null,
      manualWeightVerified: false,
      manualWeightCategoryFingerprint: null,
    })
  })

  it('clears weight check on reset', () => {
    const data = buildMandatePatchData({
      patch: { resetWeightCheck: true },
      existing: {
        ...existing,
        weightCheckMode: 'AUTO',
        actualWeightKg: { toNumber: () => 55 },
      },
      serverCategoryFingerprint: 'cat-a',
    })

    expect(data).toEqual({
      weightCheckMode: null,
      actualWeightKg: null,
      manualWeightVerified: false,
      manualWeightCategoryFingerprint: null,
    })
  })
})
