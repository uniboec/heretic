import type { AnnouncerRule } from '@prisma/client'
import type { BoutCallPayload } from '../types'
import { cornerLabel } from './corners'
import { formatAthleteName } from './names'
import { formatCategorySpeech } from './category'
import { normalizeAnnouncerText, normalizeMatNumber } from './normalize'

function formatSide(side: BoutCallPayload['sideA'], rule: AnnouncerRule): string {
  const name = formatAthleteName(side.displayName, rule.nameFormat)
  const parts: string[] = []
  if (rule.includeCorner) parts.push(`${cornerLabel(side.corner)} — ${name}`)
  else parts.push(name)
  if (rule.includeClub && side.clubName) parts.push(`клуб ${side.clubName}`)
  if (rule.includeCity && side.city) parts.push(side.city)
  return parts.join(', ')
}

export function buildBoutRepeatCallText(payload: BoutCallPayload, rule: AnnouncerRule): string {
  const side = payload.repeatSide
  const corner = payload.repeatCorner
  if (!side || !corner) return ''

  const name = formatAthleteName(side.displayName, rule.nameFormat)
  const parts: string[] = [name]
  if (rule.includeClub && side.clubName) parts.push(`клуб ${side.clubName}`)
  if (rule.includeCity && side.city) parts.push(side.city)
  const athlete = parts.join(', ')
  const matPrefix = rule.includeMat ? `На ${normalizeMatNumber(payload.matIndex)} ` : ''
  const raw = `${matPrefix}повторно приглашается в ${cornerLabel(corner, true)}: ${athlete}.`
  return normalizeAnnouncerText(raw)
}

export function buildBoutCallText(payload: BoutCallPayload, rule: AnnouncerRule, verb: 'приглашаются' | 'готовятся'): string {
  if (payload.repeatCorner && payload.repeatSide) {
    return buildBoutRepeatCallText(payload, rule)
  }
  const mat = rule.includeMat ? `${normalizeMatNumber(payload.matIndex)}, ` : ''
  const categorySpeech = formatCategorySpeech(payload.categoryTitle, rule)
  const category = categorySpeech ? ` спортсмены ${categorySpeech}, ` : ' '
  const sideA = formatSide(payload.sideA, rule)
  const sideB = formatSide(payload.sideB, rule)
  const raw = `На ${mat}${verb}${category}${sideA}; ${sideB}.`
  return normalizeAnnouncerText(raw)
}
