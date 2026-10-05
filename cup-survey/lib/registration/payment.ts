export interface PaymentDetails {
  recipientName: string
  bankName: string
  cardNumber: string
  phoneNumber: string
  inn: string
  account: string
  bik: string
  corrAccount: string
  purposeTemplate: string
}

export const PAYMENT_NO_COMMENT_NOTE =
  'При переводе не указывайте комментарий к платежу — оставьте это поле пустым.'

export function getPaymentDetails(): PaymentDetails {
  return {
    recipientName: process.env.PAYMENT_RECIPIENT_NAME ?? 'Михаил Сергеевич M.',
    bankName: process.env.PAYMENT_BANK_NAME ?? 'Сбербанк',
    cardNumber: process.env.PAYMENT_CARD_NUMBER ?? '4276161036324324',
    phoneNumber: process.env.PAYMENT_PHONE ?? '89655257700',
    inn: process.env.PAYMENT_INN ?? '',
    account: process.env.PAYMENT_ACCOUNT ?? '',
    bik: process.env.PAYMENT_BIK ?? '',
    corrAccount: process.env.PAYMENT_CORR_ACCOUNT ?? '',
    purposeTemplate:
      process.env.PAYMENT_PURPOSE_TEMPLATE ??
      'Стартовый взнос. Регистрация №{number}',
  }
}

export function formatPaymentPurpose(template: string, publicNumber: number, clubName: string): string {
  return template
    .replace('{number}', String(publicNumber))
    .replace('{club}', clubName)
}

export function normalizePaymentPhoneDigits(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`
  if (!digits.startsWith('7') && digits.length === 10) digits = `7${digits}`
  return digits
}

export function formatPaymentPhone(phone: string): string {
  const digits = normalizePaymentPhoneDigits(phone)
  if (digits.length !== 11 || !digits.startsWith('7')) return phone
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
}

export function formatCardNumber(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '')
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

export function getCardNumberCopyValue(cardNumber: string): string {
  return cardNumber.replace(/\D/g, '')
}

export function getPhoneCopyValue(phone: string): string {
  const digits = normalizePaymentPhoneDigits(phone)
  return digits ? `+${digits}` : phone
}

export function isCardPaymentConfigured(details: PaymentDetails): boolean {
  return Boolean(getCardNumberCopyValue(details.cardNumber))
}

const SBER_PHONE_TRANSFER_URL = 'https://www.sberbank.com/sms/pbpn'

function getSberPhoneDigits(phone: string): string | null {
  const digits = normalizePaymentPhoneDigits(phone)
  if (digits.length !== 11 || !digits.startsWith('7')) return null
  return digits
}

/** HTTPS-ссылка для QR-кода перевода по номеру телефона в СберБанке. */
export function getSberPhoneTransferUrl(phone: string): string | null {
  const digits = getSberPhoneDigits(phone)
  if (!digits) return null
  const params = new URLSearchParams({ requisiteNumber: digits })
  return `${SBER_PHONE_TRANSFER_URL}?${params.toString()}`
}

