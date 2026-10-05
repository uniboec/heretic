import type { AnnouncerRule } from '@prisma/client'
import type { BoutResultPayload } from '../types'
import { cornerLabel } from './corners'
import { formatAthleteName } from './names'
import { formatCategorySpeech } from './category'
import { normalizeAnnouncerText, normalizeMatNumber } from './normalize'
import { victoryMethodPhrase } from './victoryMethod'

export function buildBoutResultText(payload: BoutResultPayload, rule: AnnouncerRule): string {
  const method = rule.includeMethod ? victoryMethodPhrase(payload.victoryMethod) : 'победу'
  const name = formatAthleteName(payload.displayName, rule.nameFormat)
  const mat = rule.includeMat ? `На ${normalizeMatNumber(payload.matIndex)} ` : ''
  const categorySpeech = formatCategorySpeech(payload.categoryTitle, rule)
  const category = categorySpeech ? `${categorySpeech}, ` : ''

  let winner: string
  if (rule.includeCorner) {
    winner = `спортсмен ${cornerLabel(payload.winnerCorner, true)} ${name}`
  } else {
    winner = name
  }
  const extras: string[] = []
  if (rule.includeClub && payload.clubName) extras.push(`клуб ${payload.clubName}`)
  if (rule.includeCity && payload.city) extras.push(payload.city)
  const tail = extras.length > 0 ? `, ${extras.join(', ')}` : ''

  const raw = `${mat}${category}победу ${method} одержал ${winner}${tail}.`
  return normalizeAnnouncerText(raw)
}
