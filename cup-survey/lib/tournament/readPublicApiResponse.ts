import { readJsonError, readJsonResponse, type JsonResponseResult } from '@/lib/http/readJsonResponse'

export type PublicApiReadResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'disabled' | 'error'; status: number; error?: string }

export async function readPublicApiResponse<T>(response: Response): Promise<PublicApiReadResult<T>> {
  if (response.status === 404) {
    return { ok: false, kind: 'disabled', status: 404 }
  }

  const result = await readJsonResponse<T>(response)
  return mapPublicResult(result)
}

function mapPublicResult<T>(result: JsonResponseResult<T>): PublicApiReadResult<T> {
  if (result.ok) {
    if (
      result.data &&
      typeof result.data === 'object' &&
      'error' in result.data &&
      typeof (result.data as { error: unknown }).error === 'string'
    ) {
      return {
        ok: false,
        kind: 'error',
        status: result.status,
        error: readJsonError(result.data),
      }
    }
    return { ok: true, data: result.data }
  }

  return {
    ok: false,
    kind: 'error',
    status: result.status,
    error: result.error,
  }
}
