import { createHmac, timingSafeEqual } from 'crypto'
import { getBracketImpactTokenSecret } from '../impactTokenSecret'
import { BracketOperationError } from '../core/errors'
import { hashPlan } from './planFingerprint'
import { hashPolicy } from './policyHash'
import type { ConsolidationPlan, ConsolidationPolicy } from './types'

export type ConsolidationPlanTokenPayload = {
  version: 1
  generationId: string
  generationVersion: number
  policyHash: string
  planFingerprint: string
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

export function createConsolidationPlanToken(input: {
  generationId: string
  generationVersion: number
  policy: ConsolidationPolicy
  plan: ConsolidationPlan
  expiresAt?: string
}): string {
  const payload: ConsolidationPlanTokenPayload = {
    version: 1,
    generationId: input.generationId,
    generationVersion: input.generationVersion,
    policyHash: hashPolicy(input.policy),
    planFingerprint: hashPlan(input.plan),
    expiresAt: input.expiresAt ?? new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
  }
  const json = JSON.stringify(payload)
  return `${base64urlEncode(json)}.${signPayload(json)}`
}

export function verifyConsolidationPlanToken(token: string): ConsolidationPlanTokenPayload {
  const parts = token.split('.')
  if (parts.length !== 2) {
    throw new BracketOperationError('CONSOLIDATION_PLAN_INVALID', 'Недействительный токен плана')
  }

  const [encoded, sig] = parts
  const json = base64urlDecode(encoded)
  const expectedSig = signPayload(json)
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new BracketOperationError('CONSOLIDATION_PLAN_INVALID', 'Недействительный токен плана')
  }

  let payload: ConsolidationPlanTokenPayload
  try {
    payload = JSON.parse(json) as ConsolidationPlanTokenPayload
  } catch {
    throw new BracketOperationError('CONSOLIDATION_PLAN_INVALID', 'Недействительный токен плана')
  }

  if (payload.version !== 1) {
    throw new BracketOperationError('CONSOLIDATION_PLAN_INVALID', 'Неподдерживаемая версия токена')
  }

  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    throw new BracketOperationError('CONSOLIDATION_PLAN_INVALID', 'Токен плана истёк — запросите preview заново')
  }

  return payload
}

export function assertPlanTokenMatches(input: {
  token: ConsolidationPlanTokenPayload
  generationId: string
  generationVersion: number
  policy: ConsolidationPolicy
  plan: ConsolidationPlan
}): void {
  if (input.token.generationId !== input.generationId) {
    throw new BracketOperationError('CONSOLIDATION_PLAN_INVALID', 'Токен плана относится к другому поколению')
  }
  if (input.token.generationVersion !== input.generationVersion) {
    throw new BracketOperationError('CONSOLIDATION_PLAN_CHANGED', 'План автообъединения изменился')
  }
  if (input.token.policyHash !== hashPolicy(input.policy)) {
    throw new BracketOperationError('CONSOLIDATION_POLICY_MISMATCH', 'Политика автообъединения не совпадает')
  }
  if (input.token.planFingerprint !== hashPlan(input.plan)) {
    throw new BracketOperationError('CONSOLIDATION_PLAN_CHANGED', 'План автообъединения изменился')
  }
}
