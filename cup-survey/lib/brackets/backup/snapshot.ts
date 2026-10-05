import type { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { BracketOperationError } from '../core/errors'

export const BACKUP_SCHEMA_VERSION = 1

export type BackupCategorySnapshot = {
  id: string
  categoryKey: string
  discipline: string
  title: string
  status: string
  statusReason: string | null
  autoSystemId: string | null
  systemOverride: string | null
  autoBronzeMode: string | null
  bronzeModeOverride: string | null
  systemVersion: number | null
  drawSeed: string
  redrawRevision: number
  sourceFingerprint: string | null
  seedingFingerprint: string | null
  drawPolicyId: string | null
  drawPolicyVersion: number | null
  drawInputFingerprint: string | null
  publishedStructureJson: Prisma.JsonValue | null
  matIndex: number | null
  competitionStage: number
}

export type BackupParticipantSnapshot = {
  id: string
  drawId: string
  entryId: string
  seedPosition: number
  seedLocked: boolean
  snapshotDisplayName: string | null
  snapshotClubName: string | null
  snapshotCity: string | null
  snapshotPublicNumber: number | null
}

export type BackupPlacementSnapshot = {
  entryId: string
  categoryKey: string
  isManualMove: boolean
  movedAt: string | null
}

export type BackupSnapshotV1 = {
  schemaVersion: 1
  sourceGenerationId: string
  createdAt: string
  generation: {
    baseSeed: string
    sourceRevision: string | null
    sourceFingerprint: string | null
    version: number
  }
  categories: BackupCategorySnapshot[]
  participants: BackupParticipantSnapshot[]
  placements: BackupPlacementSnapshot[]
}

export function parseBackupSnapshot(value: unknown): BackupSnapshotV1 | null {
  if (!value || typeof value !== 'object') return null
  const snapshot = value as Partial<BackupSnapshotV1>
  if (snapshot.schemaVersion !== BACKUP_SCHEMA_VERSION) return null
  if (!snapshot.sourceGenerationId || !snapshot.generation || !Array.isArray(snapshot.categories)) {
    return null
  }
  return snapshot as BackupSnapshotV1
}

export async function buildBackupSnapshot(generationId: string): Promise<BackupSnapshotV1> {
  const generation = await prisma.bracketGeneration.findUnique({
    where: { id: generationId },
    include: {
      categories: {
        include: {
          participants: { orderBy: { seedPosition: 'asc' } },
        },
        orderBy: { categoryKey: 'asc' },
      },
    },
  })

  if (!generation) {
    throw new BracketOperationError('GENERATION_NOT_FOUND', 'Поколение сеток не найдено')
  }

  const placements = await prisma.bracketEntryPlacement.findMany({
    orderBy: { entryId: 'asc' },
  })

  const categories: BackupCategorySnapshot[] = generation.categories.map((draw) => ({
    id: draw.id,
    categoryKey: draw.categoryKey,
    discipline: draw.discipline,
    title: draw.title,
    status: draw.status,
    statusReason: draw.statusReason,
    autoSystemId: draw.autoSystemId,
    systemOverride: draw.systemOverride,
    autoBronzeMode: draw.autoBronzeMode,
    bronzeModeOverride: draw.bronzeModeOverride,
    systemVersion: draw.systemVersion,
    drawSeed: draw.drawSeed,
    redrawRevision: draw.redrawRevision,
    sourceFingerprint: draw.sourceFingerprint,
    seedingFingerprint: draw.seedingFingerprint,
    drawPolicyId: draw.drawPolicyId,
    drawPolicyVersion: draw.drawPolicyVersion,
    drawInputFingerprint: draw.drawInputFingerprint,
    publishedStructureJson: draw.publishedStructureJson,
    matIndex: draw.matIndex,
    competitionStage: draw.competitionStage,
  }))

  const participants: BackupParticipantSnapshot[] = generation.categories.flatMap((draw) =>
    draw.participants.map((participant) => ({
      id: participant.id,
      drawId: draw.id,
      entryId: participant.entryId,
      seedPosition: participant.seedPosition,
      seedLocked: participant.seedLocked,
      snapshotDisplayName: participant.snapshotDisplayName,
      snapshotClubName: participant.snapshotClubName,
      snapshotCity: participant.snapshotCity,
      snapshotPublicNumber: participant.snapshotPublicNumber,
    })),
  )

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    sourceGenerationId: generation.id,
    createdAt: new Date().toISOString(),
    generation: {
      baseSeed: generation.baseSeed,
      sourceRevision: generation.sourceRevision?.toString() ?? null,
      sourceFingerprint: generation.sourceFingerprint,
      version: generation.version,
    },
    categories,
    participants,
    placements: placements.map((placement) => ({
      entryId: placement.entryId,
      categoryKey: placement.categoryKey,
      isManualMove: placement.isManualMove,
      movedAt: placement.movedAt?.toISOString() ?? null,
    })),
  }
}
