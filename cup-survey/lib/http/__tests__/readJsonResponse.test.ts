import { describe, expect, it } from 'vitest'
import { apiErrorResponse, GENERIC_ERROR_MESSAGE } from '../apiErrorResponse'
import { readJsonError, readJsonResponse } from '../readJsonResponse'

function mockResponse(body: string, init?: ResponseInit): Response {
  if (init?.status === 204) {
    return {
      status: 204,
      ok: true,
      text: async () => body,
    } as Response
  }
  return new Response(body, init)
}

describe('readJsonResponse', () => {
  it('returns data for successful JSON responses', async () => {
    const result = await readJsonResponse<{ ok: boolean }>(
      mockResponse(JSON.stringify({ ok: true }), { status: 200 }),
    )
    expect(result).toEqual({ ok: true, status: 200, data: { ok: true } })
  })

  it('handles 500 + HTML without throwing', async () => {
    const result = await readJsonResponse(mockResponse('<html>error</html>', { status: 500 }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(500)
      expect(result.error).toBe('Некорректный ответ сервера')
      expect(result.body).toBe(undefined)
      expect('body' in result).toBe(true)
    }
  })

  it('handles 200 + malformed JSON as failure', async () => {
    const result = await readJsonResponse(mockResponse('{not-json', { status: 200 }))
    expect(result).toEqual({
      ok: false,
      status: 200,
      error: 'Некорректный ответ сервера',
      body: undefined,
    })
  })

  it('treats empty 200 as failure for ordinary JSON endpoints', async () => {
    const result = await readJsonResponse(mockResponse('', { status: 200 }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Ожидался JSON-ответ')
      expect(result.body).toBe(undefined)
    }
  })

  it('allows empty 204 success with allowEmptySuccess', async () => {
    const result = await readJsonResponse(mockResponse('', { status: 204 }), {
      allowEmptySuccess: true,
    })
    expect(result).toEqual({ ok: true, status: 204, data: undefined })
  })

  it('allows empty 200 success with allowEmptySuccess', async () => {
    const result = await readJsonResponse(mockResponse('', { status: 200 }), {
      allowEmptySuccess: true,
    })
    expect(result).toEqual({ ok: true, status: 200, data: undefined })
  })

  it('handles empty 500 bodies without throwing', async () => {
    const result = await readJsonResponse(mockResponse('', { status: 500 }))
    expect(result).toEqual({
      ok: false,
      status: 500,
      error: 'Пустой ответ сервера',
      body: undefined,
    })
  })

  it('reads admin validation errors from errors[0].message', async () => {
    const result = await readJsonResponse(
      mockResponse(
        JSON.stringify({
          errors: [{ code: 'BOUTS_PAGE_SETTING_MISSING', message: 'Настройки отсутствуют' }],
        }),
        { status: 500 },
      ),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Настройки отсутствуют')
      expect(result.body).toEqual({
        errors: [{ code: 'BOUTS_PAGE_SETTING_MISSING', message: 'Настройки отсутствуют' }],
      })
    }
  })

  it('preserves full 409 conflict payload in body', async () => {
    const payload = { code: 'VERSION_CONFLICT', error: 'Конфликт версии', draftVersion: 3 }
    const result = await readJsonResponse(
      mockResponse(JSON.stringify(payload), { status: 409 }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Конфликт версии')
      expect(result.body).toEqual(payload)
      expect('body' in result).toBe(true)
    }
  })

  it('allows reading the original response after parsing a clone', async () => {
    const response = new Response(JSON.stringify({ price: 1500 }), { status: 200 })
    const preview = await readJsonResponse<{ price: number }>(response.clone())
    const final = await readJsonResponse<{ price: number }>(response)

    expect(preview.ok).toBe(true)
    expect(final.ok).toBe(true)
    if (preview.ok && final.ok) {
      expect(preview.data.price).toBe(1500)
      expect(final.data.price).toBe(1500)
    }
  })
})

describe('readJsonError', () => {
  it('prefers error string over errors array', () => {
    expect(
      readJsonError({
        error: 'Требуется авторизация',
        errors: [{ message: 'ignored' }],
      }),
    ).toBe('Требуется авторизация')
  })
})

describe('apiErrorResponse', () => {
  it('does not leak raw exception text in outbound JSON', async () => {
    const response = apiErrorResponse(new Error('postgres password=secret-internal-detail'))

    expect(response.status).toBe(500)

    const body = await response.json()

    expect(body).toEqual({ error: GENERIC_ERROR_MESSAGE })
    expect(JSON.stringify(body)).not.toContain('secret-internal-detail')
  })
})
