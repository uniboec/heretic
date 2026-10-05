import { createHmac, timingSafeEqual } from 'crypto'
import { getBracketImpactTokenSecret } from '../impactTokenSecret'
import {
  ImpactTokenExpiredError,
  ImpactTokenInvalidError,
} from './errors'
import type { CategoryLockLevel } from './guard'

export { stableJsonHash } from './mutationFingerprint'

export type ImpactTokenOperation =
  | 'admin_registration_mutation'
  | 'standalone_force_rebuild'
  | 'settings_eligibility'
  | 'reset_live'
  | 'restore_backup'
  | 'consolidation'

export type ImpactTokenPayload = {
  version: 1
  operation: ImpactTokenOperation
  mutationFingerprint: string
  registrationId?: string
  categoryKeys?: string[]
  liveGenerationId: string
  liveGenerationVersion: number
  affectedCategoryKeys: string[]
  lockLevels: Record<string, CategoryLockLevel>
  expiresAt: string
}

const TOKEN_TTL_MS = 5 * 60 * 1000

function base64urlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function base64urlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signPayload(payloadJson: string): string {
  return createHmac('sha256', getBracketImpactTokenSecret()).update(payloadJson).digest('base64url')
}

export function createImpactToken(payload: Omit<ImpactTokenPayload, 'expiresAt'> & { expiresAt?: string }): string {
  const full: ImpactTokenPayload = {
    ...payload,
    affectedCategoryKeys: [...payload.affectedCategoryKeys].sort(),
    expiresAt: payload.expiresAt ?? new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
  }
  const json = JSON.stringify(full)
  return `${base64urlEncode(json)}.${signPayload(json)}`
}

export function verifyImpactToken(token: string): ImpactTokenPayload {
  const parts = token.split('.')
  if (parts.length !== 2) {
    throw new ImpactTokenInvalidError()
  }
  const [encoded, sig] = parts
  const json = base64urlDecode(encoded)
  const expectedSig = signPayload(json)
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new ImpactTokenInvalidError()
  }

  let payload: ImpactTokenPayload
  try {
    payload = JSON.parse(json) as ImpactTokenPayload
  } catch {
    throw new ImpactTokenInvalidError()
  }

  if (payload.version !== 1) {
    throw new ImpactTokenInvalidError('Unsupported impact token version')
  }

  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    throw new ImpactTokenExpiredError()
  }

  return payload
}

export function impactMatches(
  token: ImpactTokenPayload,
  actual: {
    operation: ImpactTokenOperation
    registrationId?: string
    mutationFingerprint: string
    liveGenerationId: string
    liveGenerationVersion: number
    affectedCategoryKeys: string[]
    lockLevels: Record<string, CategoryLockLevel>
  },
): boolean {
  const sortedActualKeys = [...actual.affectedCategoryKeys].sort()
  const sortedTokenKeys = [...token.affectedCategoryKeys].sort()

  if (token.operation !== actual.operation) return false
  if ((token.registrationId ?? undefined) !== (actual.registrationId ?? undefined)) return false
  if (token.mutationFingerprint !== actual.mutationFingerprint) return false
  if (token.liveGenerationId !== actual.liveGenerationId) return false
  if (token.liveGenerationVersion !== actual.liveGenerationVersion) return false
  if (sortedTokenKeys.length !== sortedActualKeys.length) return false
  if (sortedTokenKeys.some((k, i) => k !== sortedActualKeys[i])) return false

  const tokenKeys = Object.keys(token.lockLevels).sort()
  const actualKeys = Object.keys(actual.lockLevels).sort()
  if (tokenKeys.length !== actualKeys.length) return false
  for (let i = 0; i < tokenKeys.length; i++) {
    if (tokenKeys[i] !== actualKeys[i]) return false
    if (token.lockLevels[tokenKeys[i]] !== actual.lockLevels[actualKeys[i]]) return false
  }

  return true
}
