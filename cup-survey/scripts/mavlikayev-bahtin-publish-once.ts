#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { publishBracketDraft } from '../lib/brackets/generation/publish'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'

const TARGET = 'close_control:experienced:m_youths_3:m_youths_3_w_le_52'

async function main() {
  let draft = await requireWorkingGeneration(prisma)
  const synced = await syncBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
    categoryKeys: [TARGET],
    afterRegistrationChange: true,
  })
  draft = synced.draft
  const published = await publishBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
  })
  await setCategoriesPublicVisibility({ scope: 'category', categoryKey: TARGET, visible: true })
  console.log(JSON.stringify({ ok: true, publishedAt: published.publishedAt, version: published.version }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
