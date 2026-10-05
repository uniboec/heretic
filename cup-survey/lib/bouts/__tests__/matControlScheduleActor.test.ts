import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAdminSessionRoleMock = vi.fn()
const freezeScheduleForMatControlCommandMock = vi.fn()

vi.mock('../../auth', () => ({
  getAdminSessionRole: getAdminSessionRoleMock,
}))

vi.mock('../freezeScheduleForMatControl', () => ({
  freezeScheduleForMatControlCommand: freezeScheduleForMatControlCommandMock,
}))

vi.mock('../computeRequestFingerprint', () => ({
  computeRequestFingerprint: vi.fn(() => 'fp'),
}))

const findUniqueMock = vi.fn()
const transactionMock = vi.fn()

vi.mock('../../prisma', () => ({
  prisma: {
    boutControlCommand: {
      findUnique: findUniqueMock,
    },
    $transaction: transactionMock,
  },
}))

describe('matControl schedule actor', () => {
  beforeEach(() => {
    getAdminSessionRoleMock.mockReset()
    freezeScheduleForMatControlCommandMock.mockReset()
    findUniqueMock.mockReset()
    transactionMock.mockReset()

    getAdminSessionRoleMock.mockResolvedValue('superadmin')
    freezeScheduleForMatControlCommandMock.mockResolvedValue(null)
    findUniqueMock.mockResolvedValue({
      requestFingerprint: 'fp',
      responseJson: { ok: true },
    })
  })

  it('passes server-side actorId into schedule freeze mutation', async () => {
    const { executeMatControlCommand } = await import('../matControlService')

    await executeMatControlCommand({
      boutId: 'cat::bout-1',
      envelope: {
        operationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        holderToken: 'holder',
        expectedLiveRevision: 0,
        expectedAttemptNumber: 1,
      },
      intent: 'NO_SHOW',
      payload: { corner: 'red', entryId: 'entry-1' },
      expectedScheduleVersion: 7,
    })

    expect(freezeScheduleForMatControlCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'superadmin',
        expectedScheduleVersion: 7,
      }),
    )
  })
})
