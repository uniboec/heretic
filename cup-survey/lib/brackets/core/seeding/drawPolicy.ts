export const BALANCED_COMBAT_POLICY_ID = 'BALANCED_COMBAT'
export const BALANCED_COMBAT_POLICY_VERSION = 1

export const DEFAULT_MAX_SEARCH_NODES = 500_000

export interface DrawPolicyRef {
  drawPolicyId: string
  drawPolicyVersion: number
}

export function getDefaultDrawPolicy(): DrawPolicyRef {
  return {
    drawPolicyId: BALANCED_COMBAT_POLICY_ID,
    drawPolicyVersion: BALANCED_COMBAT_POLICY_VERSION,
  }
}
