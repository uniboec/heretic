import type { MandateCheckStatus } from '@prisma/client'
import { getWeightCategoryLabel } from '@/lib/config/fseCategories'
import { parseRegistrationCategoryKey } from '@/lib/registration/categoryIdentity'
import type { EntryPaymentStatus } from '@/lib/registration/status'
import { computeWeightStatus } from './computeWeightStatus'
import {
  buildCategoryWeightResults,
  checkWeightForCategory,
} from './weightCheck'
import type { MandateCheckRecord, MandateWarning, MandateWarningCode } from './types'

function statusWarning(
  codeUnchecked: MandateWarningCode,
  codeIssue: MandateWarningCode,
  uncheckedMessage: string,
  issueMessage: string,
  status: MandateCheckStatus,
): MandateWarning | null {
  if (status === 'UNCHECKED') {
    return { code: codeUnchecked, message: uncheckedMessage }
  }
  if (status === 'ISSUE') {
    return { code: codeIssue, message: issueMessage }
  }
  return null
}

function paymentWarning(status: EntryPaymentStatus): MandateWarning | null {
  switch (status) {
    case 'DEBT':
      return { code: 'PAYMENT_DEBT', message: 'Долг по оплате' }
    case 'UNPAID':
      return { code: 'PAYMENT_UNPAID', message: 'Оплата не подтверждена' }
    case 'PAYMENT_REVIEW':
      return { code: 'PAYMENT_REVIEW', message: 'На проверке оплаты' }
    default:
      return null
  }
}

function formatWeightMismatchMessage(input: {
  categoryKey: string
  actualWeightKg: number
  result: 'OVER_LIMIT' | 'UNDER_LIMIT'
}): string {
  const identity = parseRegistrationCategoryKey(input.categoryKey)
  const categoryLabel = identity
    ? getWeightCategoryLabel(identity.weightCategoryId)
    : input.categoryKey
  const weightCategoryId = identity?.weightCategoryId
  if (!weightCategoryId) {
    return `Вес не соответствует категории ${categoryLabel}. Требуется решение мандатной комиссии / главного судьи`
  }

  const categoryResults = buildCategoryWeightResults(input.actualWeightKg, [input.categoryKey])
  const row = categoryResults[0]
  const delta =
    row?.deltaKg != null
      ? input.result === 'OVER_LIMIT'
        ? `Превышение: ${row.deltaKg.toFixed(2)} кг`
        : `Недобор: ${row.deltaKg.toFixed(2)} кг`
      : null

  return [
    'Вес не соответствует категории',
    `Категория: ${categoryLabel}`,
    `Фактический вес: ${input.actualWeightKg.toFixed(2)} кг`,
    delta,
    'Требуется решение мандатной комиссии / главного судьи',
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildEntryVerificationWarnings(input: {
  entryId: string
  categoryKey: string
  paymentStatus: EntryPaymentStatus
  athleteCategoryKeys: string[]
  check: MandateCheckRecord | null
}): MandateWarning[] {
  const warnings: MandateWarning[] = []

  if (input.check) {
    const documents = statusWarning(
      'DOCUMENTS_UNCHECKED',
      'DOCUMENTS_ISSUE',
      'Нет документов',
      'Документы не приняты',
      input.check.documentsStatus,
    )
    if (documents) warnings.push(documents)

    const medical = statusWarning(
      'MEDICAL_UNCHECKED',
      'MEDICAL_ISSUE',
      'Нет мед. справки',
      'Мед. справка не принята',
      input.check.medicalStatus,
    )
    if (medical) warnings.push(medical)

    const insurance = statusWarning(
      'INSURANCE_UNCHECKED',
      'INSURANCE_ISSUE',
      'Нет страховки',
      'Страховка не принята',
      input.check.insuranceStatus,
    )
    if (insurance) warnings.push(insurance)
  } else {
    warnings.push(
      { code: 'DOCUMENTS_UNCHECKED', message: 'Нет документов' },
      { code: 'MEDICAL_UNCHECKED', message: 'Нет мед. справки' },
      { code: 'INSURANCE_UNCHECKED', message: 'Нет страховки' },
    )
  }

  const weightStatus = computeWeightStatus({
    check: input.check,
    categoryKeys: input.athleteCategoryKeys,
  })

  if (!weightStatus.hasWeighIn) {
    warnings.push({ code: 'WEIGHT_NOT_CHECKED', message: 'Не взвешен' })
  } else if (weightStatus.manualStale) {
    warnings.push({
      code: 'WEIGHT_MANUAL_STALE',
      message: 'Требуется повторная проверка веса',
    })
  } else if (input.check?.weightCheckMode === 'MANUAL_ISSUE') {
    warnings.push({
      code: 'WEIGHT_MANUAL_ISSUE',
      message: 'Проблема по весу (отмечена вручную)',
    })
  } else if (input.check?.weightCheckMode === 'AUTO' && input.check.actualWeightKg != null) {
    let addedWeightWarning = false
    const identity = parseRegistrationCategoryKey(input.categoryKey)
    if (identity) {
      const result = checkWeightForCategory(
        input.check.actualWeightKg,
        identity.weightCategoryId,
      )
      if (result === 'OVER_LIMIT') {
        warnings.push({
          code: 'WEIGHT_OVER_LIMIT',
          message: formatWeightMismatchMessage({
            categoryKey: input.categoryKey,
            actualWeightKg: input.check.actualWeightKg,
            result: 'OVER_LIMIT',
          }),
        })
        addedWeightWarning = true
      } else if (result === 'UNDER_LIMIT') {
        warnings.push({
          code: 'WEIGHT_UNDER_LIMIT',
          message: formatWeightMismatchMessage({
            categoryKey: input.categoryKey,
            actualWeightKg: input.check.actualWeightKg,
            result: 'UNDER_LIMIT',
          }),
        })
        addedWeightWarning = true
      }
    }
    if (!addedWeightWarning && !weightStatus.weightEligible) {
      warnings.push({
        code: 'WEIGHT_OVER_LIMIT',
        message: 'Вес не соответствует заявленным категориям спортсмена',
      })
    }
  }

  const payWarning = paymentWarning(input.paymentStatus)
  if (payWarning) warnings.push(payWarning)

  return warnings
}

export function buildEntryVerificationWarningsMap(
  entries: Array<{
    entryId: string
    categoryKey: string
    paymentStatus: EntryPaymentStatus
    athleteId: string
    athleteCategoryKeys: string[]
  }>,
  checksByAthleteId: Map<string, MandateCheckRecord | null>,
): Record<string, MandateWarning[]> {
  const result: Record<string, MandateWarning[]> = {}
  for (const entry of entries) {
    result[entry.entryId] = buildEntryVerificationWarnings({
      entryId: entry.entryId,
      categoryKey: entry.categoryKey,
      paymentStatus: entry.paymentStatus,
      athleteCategoryKeys: entry.athleteCategoryKeys,
      check: checksByAthleteId.get(entry.athleteId) ?? null,
    })
  }
  return result
}
