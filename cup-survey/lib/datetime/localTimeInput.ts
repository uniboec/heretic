const LOCAL_TIME_INPUT_MAX_DIGITS = 4

/** Formats partial HH:mm input while typing (e.g. 1030 → 10:30). */
export function formatLocalTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, LOCAL_TIME_INPUT_MAX_DIGITS)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}
