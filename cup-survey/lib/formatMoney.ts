export interface FormatMoneyOptions {
  /** Показывать знак «+» перед суммой (для доплат). По умолчанию true. */
  plus?: boolean
}

export function formatMoney(amount: number, options?: FormatMoneyOptions): string {
  const formatted = new Intl.NumberFormat('ru-RU').format(amount)
  const plus = options?.plus ?? true
  return plus ? `+${formatted} ₽` : `${formatted} ₽`
}
