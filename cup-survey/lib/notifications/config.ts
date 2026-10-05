import { tournamentInfo } from '../config/tournament'
import { getSiteUrl } from '../siteUrl'

export const ORGANIZER_NOTIFICATION_EMAIL =
  process.env.ORGANIZER_NOTIFICATION_EMAIL?.trim() || 'pervomma@yandex.ru'

export { getSiteUrl }

export function getAdminRegistrationsUrl(): string {
  return `${getSiteUrl()}/admin/registrations`
}

export function getTournamentTitle(): string {
  return tournamentInfo.title
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim())
}

export function getSmtpConfig() {
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  if (!user || !pass) return null

  const port = Number(process.env.SMTP_PORT ?? '465')
  const secure = process.env.SMTP_SECURE !== 'false'

  return {
    host: process.env.SMTP_HOST?.trim() || 'smtp.yandex.ru',
    port,
    secure,
    auth: { user, pass },
    from: process.env.SMTP_FROM?.trim() || user,
  }
}
