import { prisma } from '../../prisma'
import { BracketOperationError } from '../core/errors'
import type { BracketEligibilitySettings } from '../core/eligibility'
import { computeRestoreImpact } from '../backup/restore'
import type { ImpactTokenOperation } from './impactToken'
import {
  computeImpactForConsolidation,
  computeImpactForForceRebuild,
  computeImpactForRegistrationMutation,
  computeImpactForReset,
  computeImpactForSettingsEligibility,
} from './impact'
import { createImpactToken } from './impactToken'
import { requireWorkingGeneration } from './generation'

export type ImpactPreviewApiInput = {
  operation: string
  registrationId?: string
  mutationFingerprint?: string
  categoryKeys?: string[]
  entryIds?: string[]
  nextSettings?: BracketEligibilitySettings
  backupId?: string
  includePaid?: boolean
  includeUnpaid?: boolean
  expectedVersion?: number
  policy?: import('../consolidation/types').ConsolidationPolicy
}

function normalizeOperation(operation: string): ImpactTokenOperation {
  switch (operation) {
    case 'reset':
    case 'reset_live':
      return 'reset_live'
    case 'restore_backup':
      return 'restore_backup'
    case 'standalone_force_rebuild':
      return 'standalone_force_rebuild'
    case 'settings_eligibility':
      return 'settings_eligibility'
    case 'admin_registration_mutation':
      return 'admin_registration_mutation'
    case 'consolidation':
      return 'consolidation'
    default:
      throw new BracketOperationError('INVALID_BODY', `Неизвестная операция preview: ${operation}`)
  }
}

export async function previewBracketImpact(input: ImpactPreviewApiInput) {
  const operation = normalizeOperation(input.operation)

  return prisma.$transaction(async (tx) => {
    let impact

    switch (operation) {
      case 'admin_registration_mutation':
        if (!input.registrationId || !input.mutationFingerprint) {
          throw new BracketOperationError('INVALID_BODY', 'Некорректные данные preview')
        }
        impact = await computeImpactForRegistrationMutation(
          tx,
          input.registrationId,
          input.mutationFingerprint,
          input.categoryKeys ?? [],
          input.entryIds?.length ? { entryIds: input.entryIds } : undefined,
        )
        break
      case 'standalone_force_rebuild':
        if (!input.categoryKeys?.length) {
          throw new BracketOperationError('INVALID_BODY', 'Укажите категории для пересборки')
        }
        impact = await computeImpactForForceRebuild(tx, input.categoryKeys)
        break
      case 'settings_eligibility': {
        const nextSettings =
          input.nextSettings ??
          (input.includePaid !== undefined || input.includeUnpaid !== undefined
            ? {
                includePaid: input.includePaid ?? true,
                includeUnpaid: input.includeUnpaid ?? false,
              }
            : undefined)
        if (!nextSettings) {
          throw new BracketOperationError('INVALID_BODY', 'Укажите новые критерии допуска')
        }
        impact = await computeImpactForSettingsEligibility(tx, nextSettings)
        break
      }
      case 'reset_live':
        impact = await computeImpactForReset(tx)
        break
      case 'restore_backup':
        if (!input.backupId) {
          throw new BracketOperationError('INVALID_BODY', 'Укажите резервную копию')
        }
        impact = await computeRestoreImpact(tx, input.backupId)
        break
      case 'consolidation': {
        if (input.expectedVersion === undefined) {
          throw new BracketOperationError('INVALID_BODY', 'Укажите версию поколения')
        }
        const { validateConsolidationPolicy } = await import('../consolidation/policyHash')
        const policy = validateConsolidationPolicy(input.policy)
        if (!policy) {
          throw new BracketOperationError('INVALID_BODY', 'Укажите правила автообъединения')
        }
        const { computeConsolidationPlan } = await import('../consolidation/context')
        const ctx = await requireWorkingGeneration(tx)
        if (ctx.version !== input.expectedVersion) {
          const { VersionConflictError } = await import('../core/errors')
          throw new VersionConflictError()
        }
        const { plan } = await computeConsolidationPlan(tx, {
          generationId: ctx.id,
          policy,
        })
        impact = await computeImpactForConsolidation(tx, plan)
        break
      }
      default:
        throw new BracketOperationError('INVALID_BODY', 'Неизвестная операция preview')
    }

    const generation = await requireWorkingGeneration(tx)
    const totalCategoryCount = await tx.bracketCategoryDraw.count({
      where: { generationId: generation.id },
    })

    const impactToken = createImpactToken({
      version: 1,
      operation,
      registrationId:
        operation === 'admin_registration_mutation' ? input.registrationId : undefined,
      categoryKeys:
        operation === 'standalone_force_rebuild'
          ? [...new Set(input.categoryKeys ?? [])].sort()
          : undefined,
      mutationFingerprint: impact.mutationFingerprint,
      liveGenerationId: impact.liveGenerationId,
      liveGenerationVersion: impact.liveGenerationVersion,
      affectedCategoryKeys: impact.affectedCategoryKeys,
      lockLevels: impact.lockLevels,
    })

    return {
      ok: true,
      ...impact,
      totalCategoryCount,
      impactToken,
    }
  })
}
