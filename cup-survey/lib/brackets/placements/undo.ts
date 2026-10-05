import { prisma } from '../../prisma'
import { BracketOperationError } from '../core/errors'
import { VersionConflictError } from '../core/errors'
import { acquireBracketWriteLocks } from '../live/locks'
import { loadEligibleEntries } from '../core/eligibility'
import { getCategoryTitleFromKey } from '../../registration/categoryIdentity'
import { addParticipantToDraw, removeParticipantFromDraw } from './transfer'

async function loadFormatRules() {
  return prisma.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })
}

async function loadSettings() {
  const s = await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })
  return s ?? { includePaid: true, includeUnpaid: false }
}

function resolveCurrentCategoryKey(
  placement: { categoryKey: string } | null,
  sourceCategoryKey: string,
): string {
  return placement?.categoryKey ?? sourceCategoryKey
}

export interface BracketMoveAuditRow {
  id: string
  entryId: string
  action: 'MOVE' | 'RESET' | 'CONSOLIDATION'
  fromCategoryKey: string
  toCategoryKey: string
  fromCategoryTitle: string
  toCategoryTitle: string
  movedAt: string
  displayName: string
  canUndo: boolean
}

export async function listBracketMoveAudit(limit = 100): Promise<BracketMoveAuditRow[]> {
  const settings = await loadSettings()
  const eligible = await loadEligibleEntries({
    includePaid: settings.includePaid,
    includeUnpaid: settings.includeUnpaid,
  })
  const eligibleMap = new Map(eligible.map((e) => [e.entryId, e]))
  const eligibleIds = new Set(eligible.map((e) => e.entryId))

  const audits = await prisma.bracketMoveAudit.findMany({
    orderBy: { movedAt: 'desc' },
    take: limit,
  })

  const placements = await prisma.bracketEntryPlacement.findMany()
  const placementMap = new Map(placements.map((p) => [p.entryId, p]))

  const entryIds = [...new Set(audits.map((audit) => audit.entryId))]
  const latestForEntries = entryIds.length
    ? await prisma.bracketMoveAudit.findMany({
        where: { entryId: { in: entryIds } },
        orderBy: { movedAt: 'desc' },
      })
    : []
  const latestByEntry = new Map<string, string>()
  for (const row of latestForEntries) {
    if (!latestByEntry.has(row.entryId)) {
      latestByEntry.set(row.entryId, row.id)
    }
  }

  return audits
    .filter((audit) => eligibleIds.has(audit.entryId))
    .map((audit) => {
      const entry = eligibleMap.get(audit.entryId)!
      const placement = placementMap.get(audit.entryId) ?? null
      const currentCategoryKey = resolveCurrentCategoryKey(placement, entry.sourceCategoryKey)
      const isLatest = latestByEntry.get(audit.entryId) === audit.id
      const stateMatches = currentCategoryKey === audit.toCategoryKey

      return {
        id: audit.id,
        entryId: audit.entryId,
        action: audit.action,
        fromCategoryKey: audit.fromCategoryKey,
        toCategoryKey: audit.toCategoryKey,
        fromCategoryTitle: getCategoryTitleFromKey(audit.fromCategoryKey),
        toCategoryTitle: getCategoryTitleFromKey(audit.toCategoryKey),
        movedAt: audit.movedAt.toISOString(),
        displayName: entry.displayName,
        canUndo: isLatest && stateMatches,
      }
    })
}

export async function undoBracketMoveAudit(input: {
  auditId: string
  draftId: string
  expectedVersion: number
}) {
  const settings = await loadSettings()
  const rules = await loadFormatRules()

  const result = await prisma.$transaction(async (tx) => {
    const ctx = await acquireBracketWriteLocks(tx, { scope: 'minimal' })
    if (ctx.generation.id !== input.draftId || ctx.generation.version !== input.expectedVersion) {
      throw new VersionConflictError()
    }
    const draft = ctx.generation

    const audit = await tx.bracketMoveAudit.findUnique({ where: { id: input.auditId } })
    if (!audit) {
      throw new BracketOperationError('AUDIT_NOT_FOUND', 'Запись истории переноса не найдена')
    }

    const latest = await tx.bracketMoveAudit.findFirst({
      where: { entryId: audit.entryId },
      orderBy: { movedAt: 'desc' },
    })
    if (latest?.id !== audit.id) {
      throw new BracketOperationError(
        'UNDO_NOT_LATEST',
        'Можно отменить только последнее действие по этому участнику',
      )
    }

    const eligible = await loadEligibleEntries({
      includePaid: settings.includePaid,
      includeUnpaid: settings.includeUnpaid,
    })
    const entry = eligible.find((e) => e.entryId === audit.entryId)
    if (!entry) {
      throw new BracketOperationError(
        'ENTRY_NOT_FOUND',
        'Участник не найден или не подходит по критериям',
      )
    }

    const placement = await tx.bracketEntryPlacement.findUnique({
      where: { entryId: audit.entryId },
    })
    const currentCategoryKey = resolveCurrentCategoryKey(placement, entry.sourceCategoryKey)
    if (currentCategoryKey !== audit.toCategoryKey) {
      throw new BracketOperationError(
        'UNDO_STATE_MISMATCH',
        'Текущее размещение участника не совпадает с записью в истории',
      )
    }

    await removeParticipantFromDraw(tx, draft.id, audit.entryId, rules)
    await addParticipantToDraw(tx, {
      generationId: draft.id,
      baseSeed: draft.baseSeed,
      categoryKey: audit.fromCategoryKey,
      entryId: audit.entryId,
      rules,
    })

    if (audit.fromCategoryKey === entry.sourceCategoryKey) {
      await tx.bracketEntryPlacement.deleteMany({ where: { entryId: audit.entryId } })
    } else {
      await tx.bracketEntryPlacement.upsert({
        where: { entryId: audit.entryId },
        create: {
          entryId: audit.entryId,
          categoryKey: audit.fromCategoryKey,
          isManualMove: true,
          movedAt: new Date(),
        },
        update: {
          categoryKey: audit.fromCategoryKey,
          isManualMove: true,
          movedAt: new Date(),
        },
      })
    }

    await tx.bracketMoveAudit.delete({ where: { id: audit.id } })

    await tx.bracketGeneration.update({
      where: { id: draft.id },
      data: { version: draft.version + 1 },
    })

    return {
      ok: true,
      draft: { id: draft.id, version: draft.version + 1 },
      warnings: [] as Array<{ code: string; categoryKey?: string; n?: number }>,
    }
  })

  const { computeDiffForDraft } = await import('../dashboardDiff')
  const diff = await computeDiffForDraft(result.draft.id)
  return { ...result, diff }
}
