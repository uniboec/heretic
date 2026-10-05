import { parsePhoneNumberFromString } from 'libphonenumber-js'

const PHONE_DIGITS_LEN = 11

/** Извлекает цифры и нормализует к формату 7XXXXXXXXXX */
export function extractPhoneDigits(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (!digits) return ''

  if (digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`
  } else if (!digits.startsWith('7')) {
    digits = `7${digits}`
  }

  return digits.slice(0, PHONE_DIGITS_LEN)
}

/** Форматирует цифры в маску +7 (999) 123-45-67 */
export function formatPhoneMask(value: string): string {
  const digits = extractPhoneDigits(value)
  if (!digits) return ''

  const national = digits.startsWith('7') ? digits.slice(1) : digits

  let formatted = '+7'
  if (!national.length) return formatted

  formatted += ` (${national.slice(0, 3)}`
  if (national.length < 3) return formatted

  formatted += ')'
  if (national.length === 3) return formatted

  formatted += ` ${national.slice(3, 6)}`
  if (national.length <= 6) return formatted

  formatted += `-${national.slice(6, 8)}`
  if (national.length <= 8) return formatted

  formatted += `-${national.slice(8, 10)}`
  return formatted
}

export function normalizePhoneToE164(phone: string): string | null {
  const parsed = parsePhoneNumberFromString(phone, 'RU')
  if (!parsed || !parsed.isValid()) return null
  return parsed.format('E.164')
}

export function isValidPhone(phone: string): boolean {
  const digits = extractPhoneDigits(phone)
  if (digits.length < PHONE_DIGITS_LEN) return false
  return normalizePhoneToE164(phone) !== null
}

export const PHONE_PLACEHOLDER = '+7 (999) 123-45-67'
