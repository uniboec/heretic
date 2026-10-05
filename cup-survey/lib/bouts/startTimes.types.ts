export type MatKey = '1' | '2' | '3'

export type MatStartTimeOverrides = Partial<Record<MatKey, string>>

export const MAT_KEYS = ['1', '2', '3'] as const satisfies readonly MatKey[]
