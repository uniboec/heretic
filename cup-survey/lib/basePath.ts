export const BASE_PATH = ''

export function withBasePath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return BASE_PATH ? `${BASE_PATH}${normalized}` : normalized
}
