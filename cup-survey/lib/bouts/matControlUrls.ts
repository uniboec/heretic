import { withBasePath } from '@/lib/basePath'

export type MatControlLinkOptions = {
  boutId?: string | null
  editResult?: boolean
}

export function matControlPath(matIndex: number, options?: MatControlLinkOptions | string | null): string {
  const base = `/admin/bouts/mats/${matIndex}/control`
  const resolved =
    typeof options === 'string' || options == null
      ? { boutId: options ?? null, editResult: false }
      : options

  const params = new URLSearchParams()
  if (resolved.boutId) params.set('boutId', resolved.boutId)
  if (resolved.editResult) params.set('editResult', '1')
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

export function matControlHref(
  matIndex: number,
  options?: MatControlLinkOptions | string | null,
): string {
  return withBasePath(matControlPath(matIndex, options))
}