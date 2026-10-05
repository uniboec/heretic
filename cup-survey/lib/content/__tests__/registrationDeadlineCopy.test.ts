import { describe, expect, it } from 'vitest'
import { formatRegistrationCloseShort } from '../../datetime/tournament'
import {
  registrationDeadlineLabel,
  registrationEditFaqAnswer,
  registrationEditPageDescription,
  registrationFeesNote,
} from '../tournament-page'

describe('registration deadline copy', () => {
  const closesAt = '2026-09-25T20:00:00+05:00'

  it('formats short close time without year', () => {
    expect(formatRegistrationCloseShort(closesAt)).toMatch(/25\s+сентября.*20:00/)
  })

  it('builds public deadline labels from API value', () => {
    expect(registrationDeadlineLabel(closesAt)).toBe(
      `Регистрация закроется ${formatRegistrationCloseShort(closesAt)}`,
    )
    expect(registrationFeesNote(closesAt)).toContain('Регистрация закроется')
    expect(registrationEditPageDescription(closesAt)).toBe(
      `Можно изменить до ${formatRegistrationCloseShort(closesAt)}.`,
    )
    expect(registrationEditFaqAnswer(closesAt)).toBe(
      `Да, до ${formatRegistrationCloseShort(closesAt)} — в разделе «Мои заявки».`,
    )
  })
})
