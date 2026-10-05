import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { prisma } from '@/lib/prisma'

export async function applyPronunciationDictionary(
  text: string,
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<string> {
  const rows = await prisma.announcerPronunciation.findMany({
    where: { tournamentScopeId: scopeId },
    orderBy: { sourceText: 'desc' },
  })
  let result = text
  for (const row of rows) {
    if (!row.sourceText) continue
    result = result.split(row.sourceText).join(row.spokenText)
  }
  return result
}
