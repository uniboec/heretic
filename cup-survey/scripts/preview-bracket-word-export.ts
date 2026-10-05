/**
 * Generates local PNG/SVG previews for judge bracket control sheets.
 * Usage: npx tsx scripts/preview-bracket-word-export.ts
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildOlympicV1 } from '../lib/brackets/systems/olympic/v1/build'
import { buildThreeWayV1 } from '../lib/brackets/systems/three-way/v1/build'
import type { BracketExportCategory } from '../lib/brackets/export/types'
import { renderHeadToHeadSheet } from '../lib/brackets/print/layoutEngine/sheets/headToHeadSheet'
import { renderOlympicFourSheet } from '../lib/brackets/print/layoutEngine/sheets/olympicFourSheet'
import { renderThreeWaySheet } from '../lib/brackets/print/layoutEngine/sheets/threeWaySheet'
import { renderChampionSheetLayout } from '../lib/brackets/print/layoutEngine/sheets/championSheetLayout'
import { rasterizeSvg } from '../lib/brackets/print/rasterizeSvg'

const OUT_DIR = path.join(process.cwd(), '.preview-brackets')

function participant(
  seed: number,
  name: string,
  club = 'КСЕ «Патриот»',
  city = 'Свердловская область',
) {
  return {
    entryId: `preview-e${seed}`,
    seedPosition: seed,
    displayName: name,
    clubName: club,
    city,
  }
}

function baseCategory(partial: Partial<BracketExportCategory>): BracketExportCategory {
  return {
    categoryKey: partial.categoryKey ?? 'preview-cat',
    title: partial.title ?? 'Preview',
    discipline: 'Клоус Контрол',
    matIndex: 1,
    competitionStage: 1,
    effectiveSystemId: 'olympic',
    effectiveBronzeMode: 'TWO',
    participantCount: 2,
    structure: { systemId: 'olympic', systemVersion: 1, rounds: [], bronzeSlots: [] },
    participants: [],
    boutOutcomes: {},
    result: null,
    ...partial,
  } as BracketExportCategory
}

function syntheticCategories(): BracketExportCategory[] {
  const p2 = [
    participant(1, 'Иванов Иван Иванович'),
    participant(2, 'Петров Пётр Петрович'),
  ]
  const headToHead = baseCategory({
    categoryKey: 'preview-h2h',
    title: 'Клоус Контрол · Опытные · 12–13 лет · до 38 кг',
    participantCount: 2,
    effectiveSystemId: 'olympic',
    participants: p2,
    structure: buildOlympicV1({
      participants: p2,
      drawSeed: 'preview-h2h',
      options: { bronzeMode: 'NONE' },
    }),
  })

  const p4 = [
    participant(1, 'Соколов Алексей'),
    participant(2, 'Потапов Дмитрий'),
    participant(3, 'Скрябин Максим'),
    participant(4, 'Самиев Руслан'),
  ]
  const olympicFour = baseCategory({
    categoryKey: 'preview-olympic4',
    title: 'Клоус Контрол · Опытные · 14–15 лет · до 42 кг',
    participantCount: 4,
    effectiveBronzeMode: 'TWO',
    participants: p4,
    structure: buildOlympicV1({
      participants: p4,
      drawSeed: 'preview-olympic4',
      options: { bronzeMode: 'TWO' },
    }),
  })

  const p3 = [
    participant(1, 'Иванов Иван'),
    participant(2, 'Петров Пётр'),
    participant(3, 'Сидоров Сергей'),
  ]
  const threeWay = baseCategory({
    categoryKey: 'preview-three-way',
    title: 'Клоус Контрол · Опытные · 10–11 лет · до 32 кг',
    participantCount: 3,
    effectiveSystemId: 'three_way',
    effectiveBronzeMode: null,
    participants: p3,
    structure: buildThreeWayV1({
      participants: p3,
      drawSeed: 'preview-three-way',
      options: {},
    }),
  })

  const champion = baseCategory({
    categoryKey: 'preview-champion',
    title: 'Клоус Контрол · Опытные · 8–9 лет · до 28 кг',
    participantCount: 1,
    effectiveSystemId: 'champion',
    effectiveBronzeMode: null,
    participants: [participant(1, 'Иванов Иван')],
    structure: {
      systemId: 'champion',
      systemVersion: 1,
      rounds: [],
      bronzeSlots: [],
      champion: {
        entryId: 'preview-e1',
        displayName: 'Иванов Иван',
        clubName: 'КСЕ «Патриот»',
        city: 'Свердловская область',
        publicNumber: 1,
      },
    },
  })

  return [headToHead, olympicFour, threeWay, champion]
}

const RENDERERS = {
  'preview-h2h': renderHeadToHeadSheet,
  'preview-olympic4': renderOlympicFourSheet,
  'preview-three-way': renderThreeWaySheet,
  'preview-champion': renderChampionSheetLayout,
} as const

async function savePagePreview(category: BracketExportCategory, outDir: string) {
  const render = RENDERERS[category.categoryKey as keyof typeof RENDERERS]
  if (!render) return

  const rendered = render(category)
  const slug = category.categoryKey.replace(/[^a-z0-9-]/gi, '_')
  const png = await rasterizeSvg(rendered.svg, rendered.width, rendered.height)

  await writeFile(path.join(outDir, `${slug}.svg`), rendered.svg, 'utf8')
  await writeFile(path.join(outDir, `${slug}.png`), png)
  console.log(`${slug}: ${rendered.width}x${rendered.height}`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  for (const category of syntheticCategories()) {
    await savePagePreview(category, OUT_DIR)
  }
  console.log(`\nSaved previews to ${OUT_DIR}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
