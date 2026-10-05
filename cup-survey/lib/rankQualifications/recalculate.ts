import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { isEventFinalized } from '@/lib/bouts/eventFinalized'
import { prisma } from '@/lib/prisma'
import { evaluateCategoryBrackets } from './evaluateBracket'
import { aggregateDisciplineResults } from './evaluateDiscipline'
import { loadNormQualificationCategorySources } from './loadCategorySources'
import { getNormQualificationSettings } from './settings'

export async function recalculateNormQualifications(
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<boolean> {
  const loaded = await loadNormQualificationCategorySources()
  if (!loaded) {
    return false
  }

  const bracketDetails = loaded.categories.flatMap((category) => evaluateCategoryBrackets(category))
  const displayNameByAthleteId = new Map<string, string>()
  for (const category of loaded.categories) {
    for (const participant of category.participants) {
      displayNameByAthleteId.set(participant.athleteId, participant.displayName)
    }
  }

  const disciplineResults = aggregateDisciplineResults({
    bracketDetails,
    displayNameByAthleteId,
  }).filter((result) => result.achievedNormRank != null)

  const calculatedAt = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.rankQualificationResult.deleteMany({ where: { tournamentScopeId: scopeId } })
    await tx.rankQualificationBracketDetail.deleteMany({ where: { tournamentScopeId: scopeId } })

    const detailIdByKey = new Map<string, string>()
    for (const detail of bracketDetails) {
      const created = await tx.rankQualificationBracketDetail.create({
        data: {
          tournamentScopeId: scopeId,
          athleteId: detail.athleteId,
          discipline: detail.discipline,
          categoryKey: detail.categoryKey,
          actualBracketId: detail.categoryKey,
          placement: detail.placement,
          wins: detail.wins,
          achievedRank: detail.achievedRank,
          isAgeUp: detail.isAgeUp,
        },
      })
      detailIdByKey.set(
        `${detail.athleteId}::${detail.discipline}::${detail.categoryKey}`,
        created.id,
      )
    }

    for (const result of disciplineResults) {
      const sourceBracketDetailId =
        result.sourceCategoryKey != null
          ? detailIdByKey.get(
              `${result.athleteId}::${result.discipline}::${result.sourceCategoryKey}`,
            ) ?? null
          : null

      await tx.rankQualificationResult.create({
        data: {
          tournamentScopeId: scopeId,
          athleteId: result.athleteId,
          discipline: result.discipline,
          achievedNormRank: result.achievedNormRank,
          sourceBracketDetailId,
          displayPlacement: result.displayPlacement,
          displayWins: result.displayWins,
        },
      })
    }

    await tx.rankQualificationSetting.upsert({
      where: { tournamentScopeId: scopeId },
      create: {
        tournamentScopeId: scopeId,
        calculatedAt,
      },
      update: {
        calculatedAt,
      },
    })
  })

  return true
}

export async function maybeRecalculateOnEventFinalized(): Promise<void> {
  const finalized = await isEventFinalized()
  if (!finalized) return

  const settings = await getNormQualificationSettings()
  if (settings.calculatedAt) return

  await recalculateNormQualifications()
}
