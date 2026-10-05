#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Sync + release bouts for Close-Control · Опытные · Юноши 2 · до 61 кг on prod.
 */
import { prisma } from '../lib/prisma'
import { setCategoriesBoutsReleased } from '../lib/bouts/release'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { redrawBracketDraft } from '../lib/brackets/generation/redraw'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { computeDiffForDraft } from '../lib/brackets/dashboardDiff'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const CATEGORY_KEY = 'close_control:experienced:m_youths_2:m_youths_2_w_le_61'

async function main() {
  let draft = await requireWorkingGeneration(prisma)

  const beforeDiff = await computeDiffForDraft(draft.id)
  const beforeCat = beforeDiff.categories[CATEGORY_KEY]

  const synced = await syncBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
    categoryKeys: [CATEGORY_KEY],
    afterRegistrationChange: true,
  })
  draft = synced.draft

  const redrawn = await redrawBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
    categoryKeys: [CATEGORY_KEY],
    onlyStale: true,
  })
  draft = redrawn.draft

  const afterDiff = await computeDiffForDraft(draft.id)
  const afterCat = afterDiff.categories[CATEGORY_KEY]

  await prisma.bracketPageSetting.update({
    where: { id: 'default' },
    data: { publicEnabled: true },
  })
  await prisma.boutsPageSetting.update({
    where: { id: 'default' },
    data: { publicEnabled: true },
  })

  await prisma.$executeRaw`
    UPDATE "BracketPublicationState"
    SET visible = true, "updatedAt" = NOW()
    WHERE "categoryKey" = ${CATEGORY_KEY}
  `

  const draw = await prisma.bracketCategoryDraw.findUnique({
    where: {
      generationId_categoryKey: { generationId: draft.id, categoryKey: CATEGORY_KEY },
    },
    include: { participants: true, publicationState: true },
  })
  if (!draw?.publicationState?.publishedDrawId) {
    throw new Error(`Category not published: ${CATEGORY_KEY}`)
  }

  const result = await setCategoriesBoutsReleased({
    scope: 'category',
    categoryKey: CATEGORY_KEY,
    released: true,
    expectedPublishedDrawId: draw.publicationState.publishedDrawId,
    expectedPublishedGenerationId: draft.id,
  })

  const finalDraw = await prisma.bracketCategoryDraw.findUnique({
    where: {
      generationId_categoryKey: { generationId: draft.id, categoryKey: CATEGORY_KEY },
    },
    include: { publicationState: true, participants: true },
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        categoryKey: CATEGORY_KEY,
        title: getCategoryTitleFromKey(CATEGORY_KEY),
        beforeStale: beforeCat,
        afterStale: afterCat,
        draftVersion: draft.version,
        release: result,
        verify: {
          participantCount: finalDraw?.participants.length ?? 0,
          visible: finalDraw?.publicationState?.visible ?? false,
          boutsReleased: finalDraw?.publicationState?.boutsReleased ?? false,
        },
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
