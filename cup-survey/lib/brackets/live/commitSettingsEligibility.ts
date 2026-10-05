import { prisma } from '../../prisma'
import { BracketOperationError, VersionConflictError } from '../core/errors'
import { BRACKET_MUTATION_TX_OPTIONS } from '../core/transactionOptions'
import type { BracketEligibilitySettings } from '../core/eligibility'
import { verifyImpactTokenUnderLock } from './commitImpact'
import { DestructiveConfirmRequiredError } from './errors'
import { computeImpactForSettingsEligibility } from './impact'
import { forceRebuildCategories } from './forceRebuild'
import { acquireBracketWriteLocks } from './locks'
import { requiresDestructiveConfirm } from './commitImpact'

export async function commitSettingsEligibility(input: {
  includePaid: boolean
  includeUnpaid: boolean
  expectedVersion: number
  impactToken?: string
}): Promise<{ ok: true; generation: { id: string; version: number } }> {
  if (!input.includePaid && !input.includeUnpaid) {
    throw new BracketOperationError(
      'INVALID_ELIGIBILITY_SETTINGS',
      'Должен быть включён хотя бы один критерий допуска: оплаченные или неоплаченные.',
    )
  }

  const nextSettings: BracketEligibilitySettings = {
    includePaid: input.includePaid,
    includeUnpaid: input.includeUnpaid,
  }

  if (!input.impactToken) {
    const preview = await prisma.$transaction((tx) =>
      computeImpactForSettingsEligibility(tx, nextSettings),
    )
    if (requiresDestructiveConfirm(preview.lockLevels)) {
      throw new DestructiveConfirmRequiredError()
    }
  }

  return prisma.$transaction(async (tx) => {
    const ctx = await acquireBracketWriteLocks(tx, { scope: 'destructive_admin' })

    if (ctx.generation.version !== input.expectedVersion) {
      throw new VersionConflictError()
    }

    let affectedCategoryKeys: string[] = []
    if (input.impactToken) {
      const actual = await verifyImpactTokenUnderLock(tx, {
        impactToken: input.impactToken,
        expectedOperation: 'settings_eligibility',
        computeActual: (innerTx) => computeImpactForSettingsEligibility(innerTx, nextSettings),
      })
      affectedCategoryKeys = actual.affectedCategoryKeys
    } else {
      const actual = await computeImpactForSettingsEligibility(tx, nextSettings)
      affectedCategoryKeys = actual.affectedCategoryKeys
    }

    await tx.bracketPageSetting.upsert({
      where: { id: 'default' },
      create: {
        publicEnabled: false,
        includePaid: input.includePaid,
        includeUnpaid: input.includeUnpaid,
      },
      update: {
        includePaid: input.includePaid,
        includeUnpaid: input.includeUnpaid,
      },
    })

    if (affectedCategoryKeys.length > 0) {
      await forceRebuildCategories(tx, {
        generationId: ctx.generation.id,
        categoryKeys: affectedCategoryKeys,
        preserveVisible: true,
      })
    }

    const updated = await tx.bracketGeneration.update({
      where: { id: ctx.generation.id },
      data: { version: ctx.generation.version + 1 },
    })

    return { ok: true, generation: { id: updated.id, version: updated.version } }
  }, BRACKET_MUTATION_TX_OPTIONS)
}
