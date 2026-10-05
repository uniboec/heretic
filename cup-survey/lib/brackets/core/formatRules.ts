import type { OlympicBronzeMode } from '@prisma/client'
import { formatSystemLabel } from '../labels'
import { BRACKET_SYSTEM_IDS, BRACKET_SYSTEM_META, OLYMPIC_BRONZE_MIN_PARTICIPANTS } from '../systemMeta'
import { BracketSystemRegistry } from './registry'
import type {
  BracketFormatRuleLike,
  CategoryFormatResult,
  ValidationIssue,
} from './types'

export { BRACKET_SYSTEM_IDS } from '../systemMeta'

const CHAMPION_SYSTEM_ID = 'champion'

function isChampionSystem(systemId: string): boolean {
  return systemId === CHAMPION_SYSTEM_ID
}

/** Whether a system may appear in a format rule for the given participant range. */
export function isSystemCompatibleWithRuleRange(
  systemId: string,
  minParticipants: number,
  maxParticipants: number,
): boolean {
  const meta = BRACKET_SYSTEM_META[systemId as keyof typeof BRACKET_SYSTEM_META]
  if (!meta) return false

  if (isChampionSystem(systemId)) {
    return minParticipants === 1 && maxParticipants === 1
  }

  if (minParticipants < 2 || minParticipants > maxParticipants) return false
  if (maxParticipants > meta.maxParticipants) return false
  if ('exactParticipants' in meta && meta.exactParticipants != null) {
    return (
      minParticipants === meta.exactParticipants && maxParticipants === meta.exactParticipants
    )
  }
  return true
}

export function getCompatibleSystemIdsForRuleRange(
  minParticipants: number,
  maxParticipants: number,
): string[] {
  return BRACKET_SYSTEM_IDS.filter((systemId) =>
    isSystemCompatibleWithRuleRange(systemId, minParticipants, maxParticipants),
  )
}

/** Whether format-rule admin may set default bronze mode for this rule. */
export function isBronzeModeConfigurableForFormatRule(
  systemId: string,
  maxParticipants: number,
): boolean {
  return systemId === 'olympic' && maxParticipants >= OLYMPIC_BRONZE_MIN_PARTICIPANTS
}

/** Whether category admin may override bronze mode for the current participant count. */
export function isBronzeModeConfigurableForCategory(
  systemId: string,
  participantCount: number,
): boolean {
  return systemId === 'olympic' && participantCount >= OLYMPIC_BRONZE_MIN_PARTICIPANTS
}

export function resolveFormatRule(
  n: number,
  rules: BracketFormatRuleLike[],
): BracketFormatRuleLike | null {
  const enabled = rules.filter((r) => r.enabled).sort((a, b) => a.sortOrder - b.sortOrder)
  return enabled.find((r) => n >= r.minParticipants && n <= r.maxParticipants) ?? null
}

export function resolveCategoryFormat(
  n: number,
  rules: BracketFormatRuleLike[],
): CategoryFormatResult {
  if (n === 0) return { status: 'INACTIVE' }

  const rule = resolveFormatRule(n, rules)
  if (!rule) return { status: 'UNSUPPORTED', statusReason: 'NO_FORMAT_RULE' }

  const system = BracketSystemRegistry.tryGetLatest(rule.systemId)
  if (!system) {
    return { status: 'UNSUPPORTED', statusReason: 'SYSTEM_UNAVAILABLE' }
  }
  if (n > system.maxParticipants) {
    return { status: 'UNSUPPORTED', statusReason: 'EXCEEDS_MAX_PARTICIPANTS' }
  }

  return { status: 'ACTIVE', rule, system }
}

export function getEffectiveSystemId(
  autoSystemId: string | null,
  systemOverride: string | null,
): string | null {
  return systemOverride ?? autoSystemId
}

export function getEffectiveBronzeMode(
  autoBronzeMode: OlympicBronzeMode | null,
  bronzeModeOverride: OlympicBronzeMode | null,
): OlympicBronzeMode | null {
  return bronzeModeOverride ?? autoBronzeMode
}

export interface OverrideValidationResult {
  systemOverride: string | null
  bronzeModeOverride: OlympicBronzeMode | null
  autoSystemId: string | null
  autoBronzeMode: OlympicBronzeMode | null
  warnings: Array<{ code: string; categoryKey?: string; n?: number }>
}

export function validateOverrides(
  categoryKey: string,
  n: number,
  rule: BracketFormatRuleLike | undefined,
  autoSystemId: string | null,
  autoBronzeMode: OlympicBronzeMode | null,
  systemOverride: string | null,
  bronzeModeOverride: OlympicBronzeMode | null,
): OverrideValidationResult {
  const warnings: Array<{ code: string; categoryKey?: string; n?: number }> = []
  let nextSystemOverride = systemOverride
  let nextBronzeOverride = bronzeModeOverride

  if (systemOverride && rule && !rule.allowedSystemIds.includes(systemOverride)) {
    nextSystemOverride = null
    warnings.push({ code: 'SYSTEM_OVERRIDE_CLEARED', categoryKey, n })
  }

  const effectiveSystemId = nextSystemOverride ?? autoSystemId
  let effectiveBronzeMode = nextBronzeOverride ?? autoBronzeMode

  if (effectiveSystemId) {
    const system = BracketSystemRegistry.tryGetLatest(effectiveSystemId)
    const allowedBronze = system?.supportedBronzeModes(n) ?? null

    if (
      nextBronzeOverride &&
      (!allowedBronze || !allowedBronze.includes(nextBronzeOverride))
    ) {
      nextBronzeOverride = null
      effectiveBronzeMode = autoBronzeMode
      warnings.push({ code: 'BRONZE_OVERRIDE_CLEARED', categoryKey, n })
    }
  }

  return {
    systemOverride: nextSystemOverride,
    bronzeModeOverride: nextBronzeOverride,
    autoSystemId,
    autoBronzeMode,
    warnings,
  }
}

export function validateEntireRuleSet(rules: BracketFormatRuleLike[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const enabled = rules.filter((r) => r.enabled).sort((a, b) => a.sortOrder - b.sortOrder)

  for (const rule of enabled) {
    const system = BracketSystemRegistry.tryGetLatest(rule.systemId)
    if (!system) {
      issues.push({
        code: 'SYSTEM_UNAVAILABLE',
        message: `Система «${formatSystemLabel(rule.systemId)}» не найдена`,
      })
      continue
    }
    if (!rule.allowedSystemIds.includes(rule.systemId)) {
      issues.push({
        code: 'RULE_SYSTEM_NOT_ALLOWED',
        message: 'Система по умолчанию должна быть в списке разрешённых',
      })
    }
    if (rule.minParticipants > rule.maxParticipants) {
      issues.push({
        code: 'INVALID_RANGE',
        message: 'Минимум участников больше максимума',
      })
    }
    if (isChampionSystem(rule.systemId)) {
      if (rule.minParticipants !== 1 || rule.maxParticipants !== 1) {
        issues.push({
          code: 'INVALID_CHAMPION_RANGE',
          message: 'Система «Чемпион» допустима только для диапазона 1–1',
        })
      }
    } else if (rule.minParticipants < 2) {
      issues.push({
        code: 'INVALID_RANGE',
        message: 'Минимум участников для системы проведения должен быть не менее 2',
      })
    }
    for (const systemId of rule.allowedSystemIds) {
      const allowed = BracketSystemRegistry.tryGetLatest(systemId)
      if (!allowed) {
        issues.push({
          code: 'SYSTEM_UNAVAILABLE',
          message: `Разрешённая система «${formatSystemLabel(systemId)}» не найдена`,
        })
      } else if (rule.maxParticipants > allowed.maxParticipants) {
        issues.push({
          code: 'RULE_EXCEEDS_SYSTEM_MAX',
          message: `Максимум по правилу (${rule.maxParticipants}) превышает лимит системы «${formatSystemLabel(systemId)}» (${allowed.maxParticipants})`,
        })
      } else if (
        !isSystemCompatibleWithRuleRange(systemId, rule.minParticipants, rule.maxParticipants)
      ) {
        issues.push({
          code: 'INVALID_SYSTEM_FOR_RANGE',
          message: `Система «${formatSystemLabel(systemId)}» недопустима для диапазона ${rule.minParticipants}–${rule.maxParticipants}`,
        })
      }
    }
    if (rule.defaultBronzeMode) {
      const modes = system.supportedBronzeModes(rule.maxParticipants)
      if (!modes || !modes.includes(rule.defaultBronzeMode)) {
        issues.push({
          code: 'INVALID_BRONZE_MODE',
          message: 'Режим бронзы по умолчанию не поддерживается',
        })
      }
    }
  }

  for (let i = 0; i < enabled.length; i++) {
    for (let j = i + 1; j < enabled.length; j++) {
      const a = enabled[i]
      const b = enabled[j]
      const overlap =
        a.minParticipants <= b.maxParticipants && b.minParticipants <= a.maxParticipants
      if (overlap) {
        issues.push({
          code: 'OVERLAPPING_RANGES',
          message: `Правила пересекаются: ${a.minParticipants}–${a.maxParticipants} и ${b.minParticipants}–${b.maxParticipants}`,
        })
      }
    }
  }

  if (enabled.length > 0) {
    const supportedMin = 1
    const supportedMax = 32
    const covered = new Set<number>()
    for (const rule of enabled) {
      for (let n = rule.minParticipants; n <= rule.maxParticipants; n++) {
        covered.add(n)
      }
    }
    for (let n = supportedMin; n <= supportedMax; n++) {
      if (!covered.has(n)) {
        issues.push({
          code: 'RANGE_GAP',
          message: `Нет правила для ${n} участников в диапазоне ${supportedMin}…${supportedMax}`,
        })
      }
    }
  }

  return issues
}
