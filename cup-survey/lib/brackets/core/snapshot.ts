import type { BracketStructure } from './types'

export interface PublishedStructureSnapshot {
  snapshotSchemaVersion: 1
  systemId: string
  systemVersion: number
  structure: BracketStructure
}

export function serializePublishedStructure(input: {
  systemId: string
  systemVersion: number
  structure: BracketStructure
}): PublishedStructureSnapshot {
  return {
    snapshotSchemaVersion: 1,
    systemId: input.systemId,
    systemVersion: input.systemVersion,
    structure: input.structure,
  }
}

export function deserializePublishedStructure(
  value: unknown,
): PublishedStructureSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const snapshot = value as Partial<PublishedStructureSnapshot>
  if (snapshot.snapshotSchemaVersion !== 1) return null
  if (!snapshot.systemId || typeof snapshot.systemVersion !== 'number') return null
  if (!snapshot.structure || typeof snapshot.structure !== 'object') return null
  return snapshot as PublishedStructureSnapshot
}
