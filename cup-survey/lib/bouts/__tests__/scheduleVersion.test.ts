import { describe, expect, it, vi } from 'vitest'
import { ScheduleVersionConflictError } from '../errors'
import { bumpScheduleVersionIfNeeded } from '../scheduleStructuralMutation'
import { withScheduleVersionLock } from '../scheduleVersion'

function createSettingsTx(scheduleVersion: number) {
  const row = {
    id: 'default',
    scheduleVersion,
    matsEnabled: true,
    scheduleLegacyGap: false,
    matCount: 1,
  }
  const update = vi.fn().mockImplementation(async ({ data }: { data: { scheduleVersion?: { increment: number } } }) => ({
    ...row,
    scheduleVersion: data.scheduleVersion?.increment
      ? row.scheduleVersion + data.scheduleVersion.increment
      : row.scheduleVersion,
  }))
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    boutsPageSetting: {
      findUnique: vi.fn().mockResolvedValue(row),
      findUniqueOrThrow: vi.fn().mockResolvedValue(row),
      update,
    },
    update,
  }
}

describe('scheduleVersion lock', () => {
  it('increments version only when changed=true', async () => {
    const tx = createSettingsTx(1)

    const locked = await withScheduleVersionLock(tx as never, 1, async () => ({
      result: 'ok',
      changed: true,
    }))

    expect(locked.result).toBe('ok')
    expect(locked.scheduleVersion).toBe(2)
    expect(tx.update).toHaveBeenCalledOnce()
  })

  it('keeps version when changed=false', async () => {
    const tx = createSettingsTx(4)

    const locked = await withScheduleVersionLock(tx as never, 4, async () => ({
      result: 'noop',
      changed: false,
    }))

    expect(locked.scheduleVersion).toBe(4)
    expect(tx.update).not.toHaveBeenCalled()
  })

  it('rejects stale expected version', async () => {
    const tx = createSettingsTx(5)

    await expect(
      withScheduleVersionLock(tx as never, 4, async () => ({
        result: null,
        changed: true,
      })),
    ).rejects.toBeInstanceOf(ScheduleVersionConflictError)
  })

  it('bumps version through helper when changed', async () => {
    const tx = createSettingsTx(7)

    const next = await bumpScheduleVersionIfNeeded(tx as never, 7, true)
    expect(next).toBe(8)
  })
})
