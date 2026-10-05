import { createHash } from 'crypto'

export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (v as Record<string, unknown>)[key]
          return acc
        }, {})
    }
    return v
  })
}

export function hashFingerprint(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

export function hashDrawSeed(baseSeed: string, categoryKey: string, redrawRevision: number): string {
  return createHash('sha256')
    .update(`${baseSeed}:${categoryKey}:${redrawRevision}`)
    .digest('hex')
}
