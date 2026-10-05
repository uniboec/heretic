/** Interactive transactions for sync/redraw can touch many participant rows. */
export const BRACKET_MUTATION_TX_OPTIONS = {
  maxWait: 10_000,
  timeout: 120_000,
} as const
