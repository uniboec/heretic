#!/usr/bin/env npx tsx
/**
 * Local scenario audit: payment transitions, category key scoping, bracket consistency.
 * npx tsx scripts/run-local-scenario-audit.ts
 */
import { prisma } from '../lib/prisma'
import '../lib/brackets/systems'
import { loadCategoryKeysForEntry, loadCategoryKeysForRegistration } from '../lib/registration/bracketAutoSync'
import { loadCategoryKeysForEntryIds } from '../lib/brackets/live/impact'
import { isParticipationAffectingEntryStatus } from '../lib/registration/status'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'

type Issue = { severity: 'error' | 'warn'; code: string; message: string; detail?: unknown }

const issues: Issue[] = []

function report(severity: Issue['severity'], code: string, message: string, detail?: unknown) {
  issues.push({ severity, code, message, detail })
}

async function auditPlacementsVsParticipants() {
  const generation = await requireWorkingGeneration()
  const placements = await prisma.bracketEntryPlacement.findMany()
  const participants = await prisma.bracketDrawParticipant.findMany({
    where: { draw: { generationId: generation.id } },
    include: { draw: { select: { categoryKey: true } } },
  })
  const participantByEntry = new Map(participants.map((p) => [p.entryId, p.draw.categoryKey]))

  for (const p of placements) {
    const drawKey = participantByEntry.get(p.entryId)
    const entry = await prisma.athleteEntry.findUnique({ where: { id: p.entryId } })
    const participationEligible =
      entry &&
      ['PAID', 'DEBT', 'ADMITTED_WITHOUT_PAYMENT'].includes(entry.paymentStatus)

    if (drawKey && drawKey !== p.categoryKey) {
      report(
        'error',
        'PLACEMENT_PARTICIPANT_MISMATCH',
        `Entry ${p.entryId}: placement=${p.categoryKey}, draw=${drawKey}`,
      )
    }
    if (!drawKey && participationEligible) {
      report(
        'error',
        'ELIGIBLE_PLACEMENT_WITHOUT_PARTICIPANT',
        `Eligible entry ${p.entryId} has placement in ${p.categoryKey} but no draw participant`,
      )
    }
  }
}

async function auditPaymentCategoryScoping() {
  const entries = await prisma.athleteEntry.findMany({
    where: {
      paymentStatus: { in: ['PAID', 'DEBT', 'ADMITTED_WITHOUT_PAYMENT'] },
    },
    take: 20,
    include: { athlete: true },
  })

  for (const entry of entries) {
    try {
      const keys = await loadCategoryKeysForEntry(entry.id)
      const scoped = await prisma.$transaction((tx) =>
        loadCategoryKeysForEntryIds(tx, [entry.id]),
      )
      if (keys.join('|') !== scoped.join('|')) {
        report('error', 'CATEGORY_KEY_SCOPE_DRIFT', `Entry ${entry.id}: wrapper vs tx mismatch`, {
          keys,
          scoped,
        })
      }
      if (keys.length === 0 && isParticipationAffectingEntryStatus(entry.paymentStatus)) {
        report('warn', 'NO_CATEGORY_KEYS', `Participation-eligible entry ${entry.id} resolves to zero category keys`)
      }
    } catch (error) {
      report('error', 'CATEGORY_KEY_LOAD_FAILED', `Entry ${entry.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

async function auditStaleFlags() {
  const generation = await requireWorkingGeneration()
  const { computeDiffForDraft } = await import('../lib/brackets/dashboardDiff')
  const diff = await computeDiffForDraft(generation.id)
  if (!diff) {
    report('warn', 'NO_DRAFT_DIFF', 'computeDiffForDraft returned null')
    return
  }
  const staleComposition = Object.values(diff.categories).filter((c) => c.compositionStale).length
  const staleSeeding = Object.values(diff.categories).filter((c) => c.seedingStale || c.balanceStale).length
  if (staleComposition > 0) {
    report('warn', 'STALE_COMPOSITION', `${staleComposition} categories with compositionStale=true`)
  }
  if (staleSeeding > 0) {
    report('warn', 'STALE_SEEDING', `${staleSeeding} categories with seeding/balance stale`)
  }
}

async function auditEligibleNotInDraw() {
  const settingsRow = await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })
  const settings = settingsRow ?? { includePaid: true, includeUnpaid: false }
  const { loadEligibleEntries } = await import('../lib/brackets/core/eligibility')
  const generation = await requireWorkingGeneration()
  const eligible = await loadEligibleEntries(settings)
  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: generation.id, status: 'ACTIVE' },
    include: { participants: true },
  })
  const participantIds = new Set(draws.flatMap((d) => d.participants.map((p) => p.entryId)))
  const missing = eligible.filter((e) => !participantIds.has(e.entryId))
  if (missing.length > 0) {
    report(
      'warn',
      'ELIGIBLE_NOT_IN_DRAW',
      `${missing.length} participation-eligible entries not in any ACTIVE draw`,
      missing.slice(0, 5).map((e) => ({ entryId: e.entryId, categoryKey: e.effectiveCategoryKey })),
    )
  }
}

async function dryRunMoveValidation() {
  // Covered by moveValidation.integration.test.ts
}

async function auditImpactScopeDrift() {
  const registrations = await prisma.teamRegistration.findMany({
    where: {
      athletes: {
        some: {
          entries: {
            some: {
              paymentStatus: { in: ['PAID', 'DEBT', 'ADMITTED_WITHOUT_PAYMENT'] },
            },
          },
        },
      },
    },
    include: {
      athletes: {
        include: {
          entries: {
            where: {
              paymentStatus: { in: ['PAID', 'DEBT', 'ADMITTED_WITHOUT_PAYMENT'] },
            },
          },
        },
      },
    },
  })

  for (const registration of registrations) {
    const eligibleEntryIds = registration.athletes.flatMap((athlete) =>
      athlete.entries.map((entry) => entry.id),
    )
    if (eligibleEntryIds.length < 2) continue

    const broad = await loadCategoryKeysForRegistration(registration.id)
    for (const entryId of eligibleEntryIds.slice(0, 5)) {
      const scoped = await loadCategoryKeysForEntry(entryId)
      if (
        scoped.length > 0 &&
        broad.length > scoped.length &&
        scoped.every((key) => broad.includes(key))
      ) {
        report(
          'warn',
          'IMPACT_SCOPE_WOULD_OVERREACH',
          `Entry ${entryId} in registration ${registration.id}: scoped=${scoped.length}, team-wide=${broad.length}`,
          { scoped, broad },
        )
      }
    }
  }
}

async function main() {
  console.log('=== Local scenario audit ===')
  const version = await prisma.bracketGeneration.findFirst({
    where: { singletonKey: 'live', status: 'ACTIVE' },
    select: { version: true },
  })
  console.log('Live generation version:', version?.version ?? 'missing')

  await auditPlacementsVsParticipants()
  await auditPaymentCategoryScoping()
  await auditStaleFlags()
  await auditEligibleNotInDraw()
  await auditImpactScopeDrift()
  await dryRunMoveValidation()

  const errors = issues.filter((i) => i.severity === 'error')
  const warns = issues.filter((i) => i.severity === 'warn')

  console.log('\n--- Errors ---')
  for (const issue of errors) {
    console.log(`[${issue.code}] ${issue.message}`)
    if (issue.detail) console.log(JSON.stringify(issue.detail, null, 2))
  }
  console.log('\n--- Warnings ---')
  for (const issue of warns) {
    console.log(`[${issue.code}] ${issue.message}`)
    if (issue.detail) console.log(JSON.stringify(issue.detail, null, 2))
  }

  console.log(`\nSummary: ${errors.length} errors, ${warns.length} warnings`)
  if (errors.length > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
