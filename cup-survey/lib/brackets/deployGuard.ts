import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { BracketSystemRegistry } from './core/registry'
import './systems'

export async function assertLegacyPublishedStructuresMaterialized(): Promise<void> {
  const legacyCount = await prisma.bracketCategoryDraw.count({
    where: {
      publishedStructureJson: { equals: Prisma.DbNull },
      generation: {
        OR: [{ singletonKey: 'live' }, { status: 'ACTIVE' }],
      },
      status: 'ACTIVE',
    },
  })
  if (legacyCount > 0) {
    console.warn(
      `[deploy-guard] ${legacyCount} PUBLISHED draws without publishedStructureJson — registry builders must remain available`,
    )
  }
}

export async function assertPublishedSystemVersionsAvailable(): Promise<void> {
  await assertLegacyPublishedStructuresMaterialized()

  const pairs = await prisma.$queryRaw<Array<{ systemId: string; systemVersion: number }>>`
    SELECT DISTINCT
      COALESCE(d."systemOverride", d."autoSystemId") AS "systemId",
      d."systemVersion"
    FROM "BracketCategoryDraw" d
    JOIN "BracketGeneration" g ON g.id = d."generationId"
    WHERE (g."singletonKey" = 'live' OR g.status::text = 'PUBLISHED')
      AND d.status = 'ACTIVE'
      AND d."systemVersion" IS NOT NULL
  `

  for (const { systemId, systemVersion } of pairs) {
    if (!systemId || !BracketSystemRegistry.has(systemId, systemVersion)) {
      throw new Error(`Missing bracket system ${systemId} v${systemVersion}`)
    }
  }
}
