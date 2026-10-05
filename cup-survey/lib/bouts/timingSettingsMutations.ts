import { Prisma } from '@prisma/client'
import type { AdminBoutsSettingsPatchInput } from './schemas'
import type { NormalizedBoutsPageSettings } from './normalizeBoutsPageSettings'
import { normalizeBoutsPageSettings } from './normalizeBoutsPageSettings'
import {
  pruneMatStartTimeOverridesForMatCount,
  resolveMatStartTime,
  sanitizeMatStartTimeOverrides,
} from './startTimes'
import {
  serializeMatStartTimeOverrides,
  validateMatStartTimeOverridesForMatCount,
} from './startTimes.server'
import {
  sanitizeAgeDivisionDurationOverrides,
  type AgeDivisionDurationOverrides,
} from './boutDuration'
import {
  serializeAgeDivisionDurationOverrides,
  validateAgeDivisionDurationOverridesPatch,
} from './boutDuration.server'
import {
  deepEqualJson,
  matHasStartedHistory,
  startedMatIndexes,
  tournamentHasStarted,
} from './executionGuards'
import { TimingSettingsFrozenError } from './errors'
import type { ScheduleExecutionRecord } from './scheduleTypes'
import type { InternalBout } from './types'

function buildNormalizedFromRaw(
  raw: Parameters<typeof normalizeBoutsPageSettings>[0],
): NormalizedBoutsPageSettings {
  return normalizeBoutsPageSettings(raw)
}

export function assertTimingSettingsNotFrozen(input: {
  before: NormalizedBoutsPageSettings
  after: NormalizedBoutsPageSettings
  executions: ScheduleExecutionRecord[]
  mats: Array<{ matIndex: number; bouts: InternalBout[] }>
}): void {
  if (!tournamentHasStarted(input.executions)) {
    return
  }

  if (input.before.boutBreakMinutes !== input.after.boutBreakMinutes) {
    throw new TimingSettingsFrozenError()
  }

  if (
    !deepEqualJson(
      input.before.ageDivisionDurationOverrides,
      input.after.ageDivisionDurationOverrides,
    )
  ) {
    throw new TimingSettingsFrozenError()
  }

  const executions = new Map(input.executions.map((execution) => [execution.boutId, execution]))
  for (const matIndex of startedMatIndexes({ mats: input.mats, executions })) {
    if (
      resolveMatStartTime(matIndex, input.before) !== resolveMatStartTime(matIndex, input.after)
    ) {
      throw new TimingSettingsFrozenError()
    }
  }
}

export function resolveTimingSettingsPatch(
  lockedSettings: Awaited<ReturnType<typeof import('@prisma/client').PrismaClient.prototype.boutsPageSetting.findUniqueOrThrow>>,
  input: AdminBoutsSettingsPatchInput,
): {
  boutsStartTime: string
  matStartTimeOverrides: ReturnType<typeof sanitizeMatStartTimeOverrides>
  boutBreakMinutes: number
  ageDivisionDurationOverrides: AgeDivisionDurationOverrides
  matStartTimeOverridesWrite: ReturnType<typeof serializeMatStartTimeOverrides> | undefined
  ageDivisionDurationOverridesWrite:
    | ReturnType<typeof serializeAgeDivisionDurationOverrides>
    | undefined
} {
  const current = buildNormalizedFromRaw(lockedSettings)

  let matStartTimeOverrides = current.matStartTimeOverrides
  let matStartTimeOverridesWrite: ReturnType<typeof serializeMatStartTimeOverrides> | undefined

  if (input.matStartTimeOverrides === null || input.matStartTimeOverrides === undefined) {
    if (input.matStartTimeOverrides === null) {
      matStartTimeOverrides = {}
      matStartTimeOverridesWrite = serializeMatStartTimeOverrides({})
    }
  } else if (typeof input.matStartTimeOverrides === 'object') {
    if (Object.keys(input.matStartTimeOverrides).length === 0) {
      matStartTimeOverrides = {}
      matStartTimeOverridesWrite = serializeMatStartTimeOverrides({})
    } else {
      matStartTimeOverrides = sanitizeMatStartTimeOverrides(
        input.matStartTimeOverrides,
        lockedSettings.matCount,
      )
      validateMatStartTimeOverridesForMatCount(matStartTimeOverrides, lockedSettings.matCount)
      matStartTimeOverridesWrite = serializeMatStartTimeOverrides(matStartTimeOverrides)
    }
  }

  let ageDivisionDurationOverrides = current.ageDivisionDurationOverrides
  let ageDivisionDurationOverridesWrite:
    | ReturnType<typeof serializeAgeDivisionDurationOverrides>
    | undefined

  if (input.ageDivisionDurationOverrides === null) {
    ageDivisionDurationOverrides = {}
    ageDivisionDurationOverridesWrite = serializeAgeDivisionDurationOverrides({})
  } else if (input.ageDivisionDurationOverrides !== undefined) {
    if (Object.keys(input.ageDivisionDurationOverrides).length === 0) {
      ageDivisionDurationOverrides = {}
      ageDivisionDurationOverridesWrite = serializeAgeDivisionDurationOverrides({})
    } else {
      validateAgeDivisionDurationOverridesPatch(input.ageDivisionDurationOverrides)
      ageDivisionDurationOverrides = sanitizeAgeDivisionDurationOverrides(
        input.ageDivisionDurationOverrides,
      )
      ageDivisionDurationOverridesWrite = serializeAgeDivisionDurationOverrides(
        ageDivisionDurationOverrides,
      )
    }
  }

  const boutsStartTime =
    input.boutsStartTime !== undefined
      ? input.boutsStartTime
      : current.boutsStartTime

  const boutBreakMinutes =
    input.boutBreakMinutes !== undefined
      ? input.boutBreakMinutes
      : current.boutBreakMinutes

  matStartTimeOverrides = pruneMatStartTimeOverridesForMatCount(
    matStartTimeOverrides,
    lockedSettings.matCount,
  )

  return {
    boutsStartTime,
    matStartTimeOverrides,
    boutBreakMinutes,
    ageDivisionDurationOverrides,
    matStartTimeOverridesWrite,
    ageDivisionDurationOverridesWrite,
  }
}

export async function clearRemovedMatScheduleState(
  tx: Prisma.TransactionClient,
  input: {
    oldMatCount: number
    newMatCount: number
    matStartTimeOverrides: Record<string, string>
    mats: Array<{ matIndex: number; bouts: InternalBout[] }>
    executions: ScheduleExecutionRecord[]
  },
): Promise<Record<string, string>> {
  const executionMap = new Map(
    input.executions.map((execution) => [execution.boutId, execution]),
  )
  let overrides = { ...input.matStartTimeOverrides }

  for (let matIndex = input.newMatCount + 1; matIndex <= input.oldMatCount; matIndex += 1) {
    const matGroup = input.mats.find((mat) => mat.matIndex === matIndex)
    if (
      matGroup &&
      matHasStartedHistory({
        matIndex,
        bouts: matGroup.bouts,
        executions: executionMap,
      })
    ) {
      const { BoutAssignmentFrozenError } = await import('./errors')
      throw new BoutAssignmentFrozenError()
    }

    delete overrides[String(matIndex)]
  }

  return pruneMatStartTimeOverridesForMatCount(overrides, input.newMatCount)
}
