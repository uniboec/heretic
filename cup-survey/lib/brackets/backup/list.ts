import { prisma } from '../../prisma'

export async function listBracketBackups(): Promise<{
  backups: Array<{
    id: string
    label: string | null
    schemaVersion: number
    createdAt: string
    sourceGenerationId: string | null
    categoryCount: number
  }>
}> {
  const rows = await prisma.bracketBackup.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return {
    backups: rows.map((row) => {
      const snapshot =
        row.snapshot && typeof row.snapshot === 'object'
          ? (row.snapshot as { sourceGenerationId?: string; categories?: unknown[] })
          : null
      return {
        id: row.id,
        label: row.label,
        schemaVersion: row.schemaVersion,
        createdAt: row.createdAt.toISOString(),
        sourceGenerationId: snapshot?.sourceGenerationId ?? null,
        categoryCount: Array.isArray(snapshot?.categories) ? snapshot.categories.length : 0,
      }
    }),
  }
}
