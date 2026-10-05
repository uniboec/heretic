import { readFileSync, readdirSync, copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { buildOlympicV1 } from '../lib/brackets/systems/olympic/v1/build'
import { buildThreeWayV1 } from '../lib/brackets/systems/three-way/v1/build'
import { buildBracketPrintModel } from '../lib/brackets/print/buildBracketPrintModel'
import { renderBracketSvg } from '../lib/brackets/print/renderBracketSvg'
import { rasterizeSvg } from '../lib/brackets/print/rasterizeSvg'
import { PRINTABLE_DOCX } from '../lib/brackets/print/layoutEngine/metrics'
import type { BracketExportCategory } from '../lib/brackets/export/types'

function participant(seed: number, name: string) {
  return {
    entryId: `e${seed}`,
    seedPosition: seed,
    displayName: name,
    clubName: 'КСЕ «Патриот»',
    city: 'Свердловская область',
  }
}

function exportCategory(partial: Partial<BracketExportCategory>): BracketExportCategory {
  return {
    categoryKey: 'test',
    title: 'Test',
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

async function main() {
  const p2 = [participant(1, 'Иванов Иван Иванович'), participant(2, 'Петров Пётр Петрович')]
  const p4 = [participant(1, 'Соколов'), participant(2, 'Потапов'), participant(3, 'Скрябин'), participant(4, 'Самиев')]
  const p3 = [participant(1, 'Иванов'), participant(2, 'Петров'), participant(3, 'Сидоров')]

  const cases = [
    exportCategory({
      participantCount: 2,
      participants: p2,
      structure: buildOlympicV1({ participants: p2, drawSeed: 's', options: { bronzeMode: 'NONE' } }),
    }),
    exportCategory({
      participantCount: 4,
      participants: p4,
      structure: buildOlympicV1({ participants: p4, drawSeed: 's', options: { bronzeMode: 'TWO' } }),
    }),
    exportCategory({
      participantCount: 3,
      effectiveSystemId: 'three_way',
      participants: p3,
      structure: buildThreeWayV1({ participants: p3, drawSeed: 's', options: {} }),
    }),
  ]

  mkdirSync('.preview-brackets/docx-sizes', { recursive: true })

  for (const category of cases) {
    const model = buildBracketPrintModel(category)
    const page = model.pages[0]!
    const svg = renderBracketSvg(page)
    const png = await rasterizeSvg(svg, page.viewBoxWidth, page.viewBoxHeight)
    const printable = PRINTABLE_DOCX[page.orientation]
    const aspect = page.viewBoxHeight / page.viewBoxWidth
    let displayWidth = printable.width
    let displayHeight = Math.round(displayWidth * aspect)
    if (displayHeight > printable.height) {
      displayHeight = printable.height
      displayWidth = Math.round(displayHeight / aspect)
    }

    const slug = `${page.layoutKind}-${page.orientation}`
    copyFileSync(await sharp(png).toBuffer(), `.preview-brackets/docx-sizes/${slug}.png`)
    console.log(
      `${slug}: content ${page.viewBoxWidth}x${page.viewBoxHeight} → word ${displayWidth}x${displayHeight} (${Math.round((displayHeight / printable.height) * 100)}% height)`,
    )
  }
}

main().catch(console.error)
