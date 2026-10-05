import { describe, expect, it } from 'vitest'
import {
  formatRegistrationLimitMessage,
  getRegistrationPublicErrorMessage,
} from '../publicErrorMessages'

describe('registration public error messages', () => {
  it('formats registration limit with athlete count', () => {
    expect(formatRegistrationLimitMessage(70)).toContain('70')
    expect(formatRegistrationLimitMessage(70)).toContain('лимит участников')
  })

  it('maps registration closed to Russian text', () => {
    expect(getRegistrationPublicErrorMessage('REGISTRATION_CLOSED')).toContain('Регистрация закрыта')
  })

  it('hides unknown technical codes', () => {
    expect(getRegistrationPublicErrorMessage('SOME_NEW_CODE')).toBe(
      'Не удалось выполнить операцию. Попробуйте ещё раз.',
    )
  })

  it('passes through already localized messages', () => {
    expect(getRegistrationPublicErrorMessage('Укажите клуб')).toBe('Укажите клуб')
  })
})
