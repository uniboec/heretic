/** Shared bracket constants safe for client and server bundles. */
export const LIVE_GENERATION_SINGLETON_KEY = 'live' as const

/** When true, all bracket reads/writes use ACTIVE singleton only (post-cutover). */
export function isBracketsActiveOnlyEnabled(): boolean {
  return process.env.BRACKETS_ACTIVE_ONLY === 'true'
}
