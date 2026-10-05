export function awardsConflictMessage(body: unknown): string {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const code = typeof record?.code === 'string' ? record.code : null

  switch (code) {
    case 'CEREMONY_ALREADY_IN_PROGRESS':
      return 'Уже идёт награждение другой категории. Завершите его или обновите страницу.'
    case 'QUEUE_REVISION_CONFLICT':
      return 'Очередь изменилась. Страница обновлена.'
    case 'REVISION_CONFLICT':
      return 'Данные категории устарели. Страница обновлена.'
    case 'IDEMPOTENCY_KEY_REUSED':
      return 'Повтор операции с другим содержимым запрещён.'
    default:
      return 'Конфликт данных. Страница обновлена.'
  }
}
