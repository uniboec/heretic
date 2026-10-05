import { describe, expect, it } from 'vitest'
import { awardsConflictMessage } from '../adminErrors'

describe('awardsConflictMessage', () => {
  it('maps known conflict codes', () => {
    expect(awardsConflictMessage({ code: 'CEREMONY_ALREADY_IN_PROGRESS' })).toContain('другой категории')
    expect(awardsConflictMessage({ code: 'QUEUE_REVISION_CONFLICT' })).toContain('Очередь изменилась')
    expect(awardsConflictMessage({ code: 'REVISION_CONFLICT' })).toContain('устарели')
    expect(awardsConflictMessage({ code: 'IDEMPOTENCY_KEY_REUSED' })).toContain('Повтор операции')
    expect(awardsConflictMessage({ code: 'OPERATION_IN_PROGRESS' })).toContain('Конфликт данных')
  })
})
