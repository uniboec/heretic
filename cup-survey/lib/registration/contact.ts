import { isValidEmail, normalizeEmail } from '../email'
import { normalizePhoneToE164 } from '../phone'

export function parseRegistrationContact(
  value: string,
): { phone?: string; email?: string } | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.includes('@')) {
    if (!isValidEmail(trimmed)) return null
    return { email: normalizeEmail(trimmed) }
  }

  const phone = normalizePhoneToE164(trimmed)
  if (!phone) return null
  return { phone }
}
