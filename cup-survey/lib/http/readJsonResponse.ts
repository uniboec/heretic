export type JsonResponseResult<T> =
  | {
      ok: true
      status: number
      data: T
    }
  | {
      ok: false
      status: number
      error: string
      body: unknown | undefined
    }

/** @deprecated Use JsonResponseResult */
export type JsonReadResult<T> = JsonResponseResult<T>

export type ReadJsonResponseOptions = {
  allowEmptySuccess?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function readJsonError(json: unknown): string | undefined {
  const record = asRecord(json)
  if (!record) return undefined

  if (typeof record.error === 'string') {
    return record.error
  }

  if (Array.isArray(record.errors)) {
    const first = record.errors[0]
    const issue = asRecord(first)
    if (typeof issue?.message === 'string') {
      return issue.message
    }
  }

  return undefined
}

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300
}

function failureResult(
  status: number,
  error: string,
  body: unknown | undefined = undefined,
): JsonResponseResult<never> {
  return { ok: false, status, error, body }
}

async function readJsonResponseImpl<T>(
  response: Response,
  options?: ReadJsonResponseOptions,
): Promise<JsonResponseResult<T>> {
  const status = response.status
  const text = await response.text()

  if (!text.trim()) {
    if (response.ok && options?.allowEmptySuccess && isSuccessStatus(status)) {
      return { ok: true, status, data: undefined as T }
    }
    if (response.ok) {
      return failureResult(status, 'Ожидался JSON-ответ', undefined)
    }
    return failureResult(status, 'Пустой ответ сервера', undefined)
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return failureResult(status, 'Некорректный ответ сервера', undefined)
  }

  if (!response.ok) {
    return failureResult(status, readJsonError(json) ?? 'Не удалось загрузить данные', json)
  }

  return { ok: true, status, data: json as T }
}

export function readJsonResponse<T>(
  response: Response,
): Promise<JsonResponseResult<T>>
export function readJsonResponse(
  response: Response,
  options: { allowEmptySuccess: true },
): Promise<JsonResponseResult<void>>
export function readJsonResponse<T>(
  response: Response,
  options?: ReadJsonResponseOptions,
): Promise<JsonResponseResult<T | void>> {
  return readJsonResponseImpl(response, options)
}
