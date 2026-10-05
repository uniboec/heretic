export type BoutMatAssignments = Record<string, number>

export interface LegacyReleaseFields {
  boutsReleased: boolean
  boutMatAssignments: BoutMatAssignments | null
  matCountAtRelease: number | null
}

/** Same strict gate as new release — used by backfill and Phase-1 dual-write. */
export function computeLegacyReleaseFields(input: {
  visible: boolean
  storedMatIndex: number | null
  matCount: number
  autoBoutIds: string[]
}): LegacyReleaseFields {
  if (!input.visible) {
    return {
      boutsReleased: false,
      boutMatAssignments: null,
      matCountAtRelease: null,
    }
  }

  if (input.storedMatIndex == null) {
    if (input.matCount < 1) {
      return { boutsReleased: false, boutMatAssignments: null, matCountAtRelease: null }
    }
    const assignments: BoutMatAssignments = {}
    for (const boutId of input.autoBoutIds) {
      assignments[boutId] = 1
    }
    return {
      boutsReleased: true,
      boutMatAssignments: assignments,
      matCountAtRelease: input.matCount,
    }
  }

  if (input.storedMatIndex < 1 || input.storedMatIndex > input.matCount) {
    return { boutsReleased: false, boutMatAssignments: null, matCountAtRelease: null }
  }

  return {
    boutsReleased: true,
    boutMatAssignments: null,
    matCountAtRelease: input.matCount,
  }
}

export function parseBoutMatAssignments(value: unknown): BoutMatAssignments | null {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) return null
  const result: BoutMatAssignments = {}
  for (const [key, mat] of Object.entries(value as Record<string, unknown>)) {
    if (typeof mat === 'number' && Number.isInteger(mat)) {
      result[key] = mat
    }
  }
  return result
}
