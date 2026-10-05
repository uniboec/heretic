import { prisma } from '../prisma'
import { formatMoney } from '../formatMoney'
import { formatAthleteFullName } from '../registration/athleteName'
import { serializeAthleteEntries } from '../registration/entrySerialization'
import { getAdminRegistrationsUrl, getTournamentTitle } from './config'
import { escapeHtml, sendOrganizerEmail } from './mail'

function notifyInBackground(task: () => Promise<void>): void {
  void task().catch((error) => {
    console.error('[notifications]', error)
  })
}

export function notifyOrganizerNewRegistration(registrationId: string): void {
  notifyInBackground(async () => {
    const registration = await prisma.teamRegistration.findUnique({
      where: { id: registrationId },
      include: {
        athletes: { include: { entries: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] },
      },
    })
    if (!registration) return

    const athleteCount = registration.athletes.length
    const entryCount = registration.athletes.reduce((sum, athlete) => sum + athlete.entries.length, 0)
    const athleteLines = registration.athletes.map((athlete) => {
      const name = formatAthleteFullName(athlete)
      const categories = serializeAthleteEntries(athlete.entries, athlete.rank)
        .map((entry) => entry.categoryLabel)
        .join('; ')
      return `• ${name}: ${categories}`
    })

    const subject = `Новая регистрация №${registration.publicNumber} — ${registration.clubName}`
    const text = [
      `Новая заявка на ${getTournamentTitle()}`,
      '',
      `Номер заявки: ${registration.publicNumber}`,
      `Клуб: ${registration.clubName}, ${registration.city}`,
      `Телефон: ${registration.phone}`,
      registration.email ? `Почта: ${registration.email}` : null,
      `Спортсменов: ${athleteCount}`,
      `Категорий: ${entryCount}`,
      `Сумма: ${formatMoney(registration.totalAmount, { plus: false })}`,
      '',
      'Состав:',
      ...athleteLines,
      '',
      `Админка: ${getAdminRegistrationsUrl()}`,
    ]
      .filter(Boolean)
      .join('\n')

    const html = `
      <h2>Новая регистрация</h2>
      <p><strong>Заявка №${registration.publicNumber}</strong></p>
      <ul>
        <li>Клуб: ${escapeHtml(registration.clubName)}, ${escapeHtml(registration.city)}</li>
        <li>Телефон: ${escapeHtml(registration.phone)}</li>
        ${registration.email ? `<li>Почта: ${escapeHtml(registration.email)}</li>` : ''}
        <li>Спортсменов: ${athleteCount}</li>
        <li>Категорий: ${entryCount}</li>
        <li>Сумма: ${escapeHtml(formatMoney(registration.totalAmount, { plus: false }))}</li>
      </ul>
      <p><strong>Состав:</strong></p>
      <ul>
        ${athleteLines.map((line) => `<li>${escapeHtml(line.replace(/^•\s*/, ''))}</li>`).join('')}
      </ul>
      <p><a href="${escapeHtml(getAdminRegistrationsUrl())}">Открыть админку</a></p>
    `

    await sendOrganizerEmail(subject, text, html)
  })
}

/** Уведомление организатору: участник оплатил и загрузил квитанцию. */
export function notifyOrganizerPaymentProof(registrationId: string, proofId: string): void {
  notifyInBackground(async () => {
    const registration = await prisma.teamRegistration.findUnique({
      where: { id: registrationId },
      select: {
        publicNumber: true,
        clubName: true,
        city: true,
        phone: true,
        email: true,
      },
    })
    if (!registration) return

    const proof = await prisma.paymentProof.findFirst({
      where: { id: proofId, registrationId },
      include: {
        entries: {
          include: {
            entry: {
              include: {
                athlete: true,
              },
            },
          },
        },
      },
    })
    if (!proof) return

    const entryLines = proof.entries.map((link) => {
      const athlete = link.entry.athlete
      const name = formatAthleteFullName(athlete)
      const category =
        link.entry.ageDivisionId && link.entry.weightCategoryId
          ? serializeAthleteEntries([link.entry], athlete.rank)[0]?.categoryLabel ?? 'категория'
          : 'категория'
      return `• ${name}: ${category}`
    })

    const amountLabel = proof.amount
      ? formatMoney(proof.amount, { plus: false })
      : 'не указана'

    const subject = `Оплата участия — заявка №${registration.publicNumber} — ${registration.clubName}`
    const text = [
      `Участник оплатил участие в ${getTournamentTitle()}`,
      '',
      `Заявка №${registration.publicNumber}`,
      `Клуб: ${registration.clubName}, ${registration.city}`,
      `Телефон: ${registration.phone}`,
      registration.email ? `Почта: ${registration.email}` : null,
      `Сумма оплаты: ${amountLabel}`,
      `Оплаченных категорий: ${proof.entries.length}`,
      '',
      'Позиции:',
      ...entryLines,
      '',
      'Квитанция загружена — проверьте оплату в админке.',
      getAdminRegistrationsUrl(),
    ]
      .filter(Boolean)
      .join('\n')

    const html = `
      <h2>Оплата участия</h2>
      <p>Участник оплатил участие и загрузил квитанцию для проверки.</p>
      <p><strong>Заявка №${registration.publicNumber}</strong></p>
      <ul>
        <li>Клуб: ${escapeHtml(registration.clubName)}, ${escapeHtml(registration.city)}</li>
        <li>Телефон: ${escapeHtml(registration.phone)}</li>
        ${registration.email ? `<li>Почта: ${escapeHtml(registration.email)}</li>` : ''}
        <li>Сумма оплаты: ${escapeHtml(amountLabel)}</li>
        <li>Оплаченных категорий: ${proof.entries.length}</li>
      </ul>
      <p><strong>Позиции:</strong></p>
      <ul>
        ${entryLines.map((line) => `<li>${escapeHtml(line.replace(/^•\s*/, ''))}</li>`).join('')}
      </ul>
      <p><a href="${escapeHtml(getAdminRegistrationsUrl())}">Проверить в админке</a></p>
    `

    await sendOrganizerEmail(subject, text, html)
  })
}
