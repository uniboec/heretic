import type { AnnouncerEventType, AnnouncerRule } from '@prisma/client'
import type {
  AwardCallPayload,
  BoutCallPayload,
  BoutResultPayload,
} from '../types'
import { buildAwardCallText } from './buildAwardCall'
import { buildBoutCallText } from './buildBoutCall'
import { buildBoutResultText } from './buildBoutResult'

export function buildAnnouncementText(
  type: AnnouncerEventType,
  payload: unknown,
  rule: AnnouncerRule,
): string {
  switch (type) {
    case 'BOUT_CALL':
      return buildBoutCallText(payload as BoutCallPayload, rule, 'приглашаются')
    case 'BOUT_PREPARE':
      return buildBoutCallText(payload as BoutCallPayload, rule, 'готовятся')
    case 'BOUT_RESULT':
      return buildBoutResultText(payload as BoutResultPayload, rule)
    case 'AWARD_CALL':
      return buildAwardCallText(payload as AwardCallPayload, rule, 'приглашаются')
    case 'AWARD_PREPARE':
      return buildAwardCallText(payload as AwardCallPayload, rule, 'готовятся')
    default:
      return ''
  }
}
