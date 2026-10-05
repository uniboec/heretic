import type { BracketExportCategory } from '../../../export/types'
import { buildSlotContext, resolvePlacementSlot } from '../../resolvePrintSlots'
import { drawAthleteBlock, drawSectionLabel } from '../primitives'
import { finalizeSvg, escapeXml } from '../metrics'

const FONT = 'Arial, Helvetica, sans-serif'
const INK = '#111111'
const MUTED = '#555555'

export function renderChampionSheetLayout(category: BracketExportCategory): {
  svg: string
  width: number
  height: number
} {
  const ctx = buildSlotContext(category)
  const champion =
    category.structure.champion ??
    (category.participants[0]
      ? {
          entryId: category.participants[0].entryId,
          displayName: category.participants[0].displayName,
          clubName: category.participants[0].clubName,
          city: category.participants[0].city ?? '',
        }
      : null)

  const slot = champion
    ? {
        kind: 'ATHLETE' as const,
        entryId: champion.entryId,
        seedPosition: category.participants.find((p) => p.entryId === champion.entryId)?.seedPosition ?? 1,
        name: champion.displayName,
        club: champion.clubName,
        city: champion.city,
        score: null,
      }
    : resolvePlacementSlot(ctx, 1)

  const x = 80
  const y = 80
  const cardWidth = 480
  const cardHeight = 220

  const athlete = drawAthleteBlock(x + 24, y + 72, slot, { showScoreBox: false, nameMaxWidth: 400 })
  const title = drawSectionLabel(x + 24, y + 36, 'ПОБЕДИТЕЛЬ КАТЕГОРИИ')

  const placementLine =
    slot.kind === 'ATHLETE'
      ? `<text x="${x + 24}" y="${y + cardHeight - 28}" font-family="${FONT}" font-size="13" font-weight="700" fill="${INK}">1 место: ${escapeXml(slot.name)}</text>`
      : ''

  const card = `
    <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" fill="#FAFAFA" stroke="${INK}" stroke-width="2" rx="6"/>
    ${title}
    ${athlete.svg}
    ${placementLine}
  `

  return finalizeSvg([card], { x: 40, y: 40, width: cardWidth + 80, height: cardHeight + 120 })
}
