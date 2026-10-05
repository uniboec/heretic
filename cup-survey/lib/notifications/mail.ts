import nodemailer from 'nodemailer'
import { getSmtpConfig, isMailConfigured, ORGANIZER_NOTIFICATION_EMAIL } from './config'

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransporter(): ReturnType<typeof nodemailer.createTransport> | null {
  if (!isMailConfigured()) return null
  if (!transporter) {
    const config = getSmtpConfig()
    if (!config) return null
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    })
  }
  return transporter
}

export async function sendOrganizerEmail(subject: string, text: string, html: string): Promise<void> {
  const transport = getTransporter()
  const config = getSmtpConfig()
  if (!transport || !config) {
    console.warn('[mail] SMTP не настроен — уведомление не отправлено:', subject)
    return
  }

  await transport.sendMail({
    from: config.from,
    to: ORGANIZER_NOTIFICATION_EMAIL,
    subject,
    text,
    html,
  })
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
