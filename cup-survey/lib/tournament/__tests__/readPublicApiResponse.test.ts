import { describe, expect, it } from 'vitest'
import { readPublicApiResponse } from '../readPublicApiResponse'

describe('readPublicApiResponse', () => {
  it('maps 404 to disabled kind without parsing body', async () => {
    const result = await readPublicApiResponse(
      new Response('', { status: 404 }),
    )

    expect(result).toEqual({ ok: false, kind: 'disabled', status: 404 })
  })

  it('returns successful JSON payloads', async () => {
    const result = await readPublicApiResponse<{ participants: string[] }>(
      new Response(JSON.stringify({ participants: ['a'] }), { status: 200 }),
    )

    expect(result).toEqual({ ok: true, data: { participants: ['a'] } })
  })

  it('maps JSON error payloads in 200 responses to error kind', async () => {
    const result = await readPublicApiResponse(
      new Response(JSON.stringify({ error: 'Раздел недоступен' }), { status: 200 }),
    )

    expect(result).toEqual({
      ok: false,
      kind: 'error',
      status: 200,
      error: 'Раздел недоступен',
    })
  })

  it('maps non-2xx JSON failures to error kind with message', async () => {
    const result = await readPublicApiResponse(
      new Response(JSON.stringify({ error: 'Ошибка сервера' }), { status: 500 }),
    )

    expect(result).toEqual({
      ok: false,
      kind: 'error',
      status: 500,
      error: 'Ошибка сервера',
    })
  })
})
