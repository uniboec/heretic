import { prisma } from '../prisma'
import { TOURNAMENT_SCOPE_ID } from '../config/tournament'
import { loadBoutEvents } from './matControlContext'
import { mapEventRow } from './matControlMappers'
import { getCurrentBoutResult } from './boutResultQueries'
import {
  getBlockingConfirmIssues,
  resolveProposedVictoryMethod,
  validateConfirmBout,
  type ConfirmValidationIssueCode,
} from './confirmValidation'
import { wasFightClockStarted } from '../fastestFights/fightClockStarted'

export type MatControlAuditFinding = {
  boutId: string
  issueCode: ConfirmValidationIssueCode | 'RATING_BRACKET_MISMATCH' | 'MISSING_FIGHT_OFFICIALLY_STARTED'
  issueMessage: string
  victoryMethod: string | null
  scheduleNumber?: string | null
  categoryKey?: string | null
}

export async function scanMatControlAuditFindings(limit = 200): Promise<MatControlAuditFinding[]> {
  const results = await prisma.boutResult.findMany({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID, invalidatedAt: null },
    orderBy: { resultConfirmedAt: 'desc' },
    take: limit,
    select: {
      boutId: true,
      victoryMethod: true,
      fightOfficiallyStarted: true,
    },
  })

  const findings: MatControlAuditFinding[] = []

  for (const result of results) {
    const events = (await loadBoutEvents(prisma, result.boutId)).map(mapEventRow)
    const victoryMethod = result.victoryMethod ?? resolveProposedVictoryMethod(events)
    const issues = validateConfirmBout({
      victoryMethod: victoryMethod as ReturnType<typeof resolveProposedVictoryMethod>,
      events,
      attemptNumber: 1,
      period: 'main',
      injuryScoreAcknowledged: true,
    })

    for (const issue of getBlockingConfirmIssues(issues)) {
      findings.push({
        boutId: result.boutId,
        issueCode: issue.code,
        issueMessage: issue.message,
        victoryMethod: result.victoryMethod,
      })
    }

    const clockStarted = wasFightClockStarted(events)
    if (!result.fightOfficiallyStarted && clockStarted) {
      findings.push({
        boutId: result.boutId,
        issueCode: 'MISSING_FIGHT_OFFICIALLY_STARTED',
        issueMessage: 'fightOfficiallyStarted=false при наличии CLOCK_START в событиях',
        victoryMethod: result.victoryMethod,
      })
    }
  }

  return findings
}

export async function listMatControlAuditEntries(limit = 100) {
  return prisma.matControlAuditEntry.findMany({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    orderBy: { detectedAt: 'desc' },
    take: limit,
  })
}

export async function recordMatControlAuditFindings(findings: MatControlAuditFinding[]) {
  if (findings.length === 0) return []
  const created = []
  for (const finding of findings) {
    const existing = await prisma.matControlAuditEntry.findFirst({
      where: {
        boutId: finding.boutId,
        issueCode: finding.issueCode,
        resolvedAt: null,
      },
    })
    if (existing) continue
    const row = await prisma.matControlAuditEntry.create({
      data: {
        boutId: finding.boutId,
        issueCode: finding.issueCode,
        issueMessage: finding.issueMessage,
        victoryMethod: finding.victoryMethod,
        metadata: {
          scheduleNumber: finding.scheduleNumber ?? null,
          categoryKey: finding.categoryKey ?? null,
        },
      },
    })
    created.push(row)
  }
  return created
}

export async function resolveMatControlAuditEntry(input: {
  entryId: string
  resolvedBy: string
  resolutionNote: string
}) {
  return prisma.matControlAuditEntry.update({
    where: { id: input.entryId },
    data: {
      resolvedAt: new Date(),
      resolvedBy: input.resolvedBy,
      resolutionNote: input.resolutionNote,
    },
  })
}

export async function getMatControlAuditDashboard() {
  const [findings, entries, correctionCases, recentVersions] = await Promise.all([
    scanMatControlAuditFindings(100),
    listMatControlAuditEntries(50),
    prisma.resultCorrectionCase.findMany({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        sourceBoutId: true,
        reason: true,
        requestedBy: true,
        appliedAt: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.boutResult.findMany({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
      orderBy: { resultConfirmedAt: 'desc' },
      take: 20,
      select: {
        boutId: true,
        resultVersion: true,
        victoryMethod: true,
        resultConfirmedAt: true,
        invalidatedAt: true,
      },
    }),
  ])

  return {
    openFindings: findings,
    auditEntries: entries,
    correctionCases,
    recentResultVersions: recentVersions,
  }
}

export async function getBoutAuditTrail(boutId: string) {
  const [result, events, commands, corrections, versions] = await Promise.all([
    getCurrentBoutResult(prisma, boutId),
    loadBoutEvents(prisma, boutId),
    prisma.boutControlCommand.findMany({
      where: { boutId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    }),
    prisma.resultCorrectionCase.findMany({
      where: { sourceBoutId: boutId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.boutResult.findMany({
      where: { boutId },
      orderBy: { resultVersion: 'desc' },
    }),
  ])

  return {
    result,
    events,
    commands,
    corrections,
    versions,
  }
}
