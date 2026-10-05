export const REGISTRATION_PUBLIC_ERROR_MESSAGES: Record<string, string> = {
  REGISTRATION_CLOSED: 'Регистрация закрыта. Новые заявки не принимаются.',
  INTERNAL_ERROR:
    'Не удалось сохранить заявку. Попробуйте ещё раз или обратитесь к организаторам.',
  Forbidden: 'Запрос отклонён. Обновите страницу и попробуйте снова.',
  'Too many requests': 'Слишком много попыток. Подождите несколько минут и попробуйте снова.',
  'Invalid JSON': 'Некорректные данные. Обновите страницу и попробуйте снова.',
  NOT_FOUND: 'Заявка не найдена.',
  INVALID_CODE: 'Неверный секретный код.',
  EDIT_AUTH_REQUIRED: 'Для редактирования введите секретный код.',
  DEVICE_REQUIRED: 'Не удалось определить устройство. Обновите страницу и попробуйте снова.',
  INVALID_STATUS: 'Эти категории уже отправлены на проверку или оплачены.',
  INVALID_FILE_TYPE: 'Поддерживаются только JPG, PNG и PDF.',
  FILE_TOO_LARGE: 'Файл слишком большой. Максимум 5 МБ.',
  FILE_REQUIRED: 'Выберите файл квитанции.',
  INVALID_ENTRY_IDS: 'Выберите категории для оплаты.',
  ENTRY_IDS_REQUIRED: 'Выберите категории для оплаты.',
  INVALID_ENTRIES: 'Выбранные категории не найдены.',
  UPLOAD_FAILED: 'Не удалось загрузить файл. Попробуйте ещё раз.',
}

const TECHNICAL_ERROR_PATTERN = /^[A-Z][A-Z0-9_]*$/

export function formatRegistrationLimitMessage(maxAthletes: number | null): string {
  return maxAthletes != null
    ? `Достигнут лимит участников турнира (${maxAthletes}). Новые заявки сейчас не принимаются.`
    : 'Достигнут лимит участников турнира. Новые заявки сейчас не принимаются.'
}

export function getRegistrationPublicErrorMessage(
  error: string | undefined | null,
  fallback = 'Не удалось выполнить операцию. Попробуйте ещё раз.',
): string {
  if (!error) return fallback
  const mapped = REGISTRATION_PUBLIC_ERROR_MESSAGES[error]
  if (mapped) return mapped
  if (error === 'REGISTRATION_LIMIT') return formatRegistrationLimitMessage(null)
  if (TECHNICAL_ERROR_PATTERN.test(error)) return fallback
  return error
}
