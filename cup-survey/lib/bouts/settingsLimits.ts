/** Shared limits for bouts page settings — used by Zod schema and admin UI. */
export const MAT_COUNT_MIN = 1
export const MAT_COUNT_MAX = 3

export const BOUT_BREAK_MINUTES_MIN = 0
export const BOUT_BREAK_MINUTES_MAX = 30

export const AGE_DIVISION_DURATION_MIN = 1
export const AGE_DIVISION_DURATION_MAX = 60

export const MAT_COUNT_OPTIONS = Array.from(
  { length: MAT_COUNT_MAX - MAT_COUNT_MIN + 1 },
  (_, index) => MAT_COUNT_MIN + index,
)

export const ATHLETE_SPACING_BOUT_COUNT_REGULAR_MIN = 2
export const ATHLETE_SPACING_BOUT_COUNT_MEDAL_MIN = 5
export const ATHLETE_SPACING_BOUT_COUNT_MAX = 20
export const ATHLETE_SPACING_TIME_MAX_MINUTES = 120
export const ATHLETE_SPACING_TIME_REGULAR_DEFAULT = 10
export const ATHLETE_SPACING_TIME_MEDAL_DEFAULT = 20
