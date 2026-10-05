import type { AnnouncerRule } from '@prisma/client'
import type { AwardCallPayload, AwardPlacementPayload } from '../types'
import { formatAthleteName } from './names'
import { formatCategorySpeech } from './category'
import { normalizeAnnouncerText } from './normalize'

const PLACEMENT_WORDS: Record<number, string> = {
  1: 'Первое место',
  2: 'Второе место',
  3: 'Третье место',
}

function formatPlacementRow(row: AwardPlacementPayload, rule: AnnouncerRule): string {
  const name = formatAthleteName(row.displayName, rule.nameFormat)
  const parts = [name]
  if (rule.includeClub && row.clubName) parts.push(`клуб ${row.clubName}`)
  if (rule.includeCity && row.city) parts.push(row.city)
  const body = parts.join(', ')
  if (rule.includePlacement) {
    const label = PLACEMENT_WORDS[row.placement] ?? `${row.placement} место`
    return `${label} — ${body}`
  }
  return body
}

export function buildAwardRepeatPlacementText(
  payload: AwardCallPayload,
  rule: AnnouncerRule,
  verb: 'приглашаются' | 'готовятся',
): string {
  const row = payload.repeatPlacement
  if (!row) return ''

  const name = formatAthleteName(row.displayName, rule.nameFormat)
  const parts = [name]
  if (rule.includeClub && row.clubName) parts.push(`клуб ${row.clubName}`)
  if (rule.includeCity && row.city) parts.push(row.city)
  const athlete = parts.join(', ')
  const categorySpeech = formatCategorySpeech(payload.categoryTitle, rule)
  const placementLabel = PLACEMENT_WORDS[row.placement] ?? `${row.placement} место`
  const zone =
    verb === 'приглашаются'
      ? 'Повторно на награждение приглашается'
      : 'Повторно к награждению готовится'
  const categorySuffix = categorySpeech ? `, категория ${categorySpeech}` : ''
  const raw = `${zone} ${placementLabel} — ${athlete}${categorySuffix}.`
  return normalizeAnnouncerText(raw)
}

export function buildAwardCallText(
  payload: AwardCallPayload,
  rule: AnnouncerRule,
  verb: 'приглашаются' | 'готовятся',
): string {
  if (payload.repeatPlacement) {
    return buildAwardRepeatPlacementText(payload, rule, verb)
  }

  const categorySpeech = formatCategorySpeech(payload.categoryTitle, rule)
  const category = categorySpeech ? ` спортсмены ${categorySpeech}, ` : ' спортсмены '

  const byPlacement = new Map<number, AwardPlacementPayload[]>()
  for (const p of payload.placements) {
    const list = byPlacement.get(p.placement) ?? []
    list.push(p)
    byPlacement.set(p.placement, list)
  }

  const placementTexts: string[] = []
  for (const placement of [...byPlacement.keys()].sort((a, b) => a - b)) {
    const rows = byPlacement.get(placement)!
    if (rule.includePlacement && rows.length === 1) {
      placementTexts.push(formatPlacementRow(rows[0], rule))
    } else if (rule.includePlacement && rows.length > 1) {
      const names = rows.map((r) => formatAthleteName(r.displayName, rule.nameFormat)).join(' и ')
      const label = PLACEMENT_WORDS[placement] ?? `${placement} место`
      placementTexts.push(`${label} — ${names}`)
    } else {
      placementTexts.push(rows.map((r) => formatPlacementRow(r, rule)).join('; '))
    }
  }

  const zonePrefix = payload.repeatCategory ? 'Повторно ' : ''
  const zone =
    verb === 'приглашаются'
      ? `${zonePrefix}В зону награждения приглашаются`
      : `${zonePrefix}К награждению готовятся`
  const raw = `${zone}${category}${placementTexts.join('. ')}.`
  return normalizeAnnouncerText(raw)
}
