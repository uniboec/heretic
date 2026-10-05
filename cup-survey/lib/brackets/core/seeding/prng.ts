import { createHash } from 'crypto'

/** Deterministic seeded PRNG (mulberry32). */
export function createSeededRandom(seed: string): () => number {
  const hash = createHash('sha256').update(seed).digest()
  let state = hash.readUInt32BE(0) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const arr = [...items]
  const random = createSeededRandom(seed)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
