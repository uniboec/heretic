import type { MandateCheckStatus } from '@prisma/client'

export const mandateCheckStatusLabels: Record<MandateCheckStatus, string> = {
  UNCHECKED: 'Нет',
  VERIFIED: 'OK',
  ISSUE: '!',
}

export const mandateCheckStatusTitles: Record<MandateCheckStatus, string> = {
  UNCHECKED: 'Не проверено',
  VERIFIED: 'Подтверждено',
  ISSUE: 'Проблема',
}

export const aggregateStatusLabels = {
  all_ok: 'Допуск OK',
  has_issues: 'Есть замечания',
  not_checked: 'Не проверен',
} as const
