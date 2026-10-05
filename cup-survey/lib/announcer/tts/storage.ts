import { createHash } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'

const CACHE_ROOT =
  process.env.ANNOUNCER_CACHE_DIR ?? path.join(process.cwd(), 'data', 'announcer-cache')

export function getAnnouncerCacheRoot(): string {
  return CACHE_ROOT
}

export function buildCacheKey(input: {
  provider: string
  voiceId: string
  speechRate: number
  text: string
}): string {
  const hash = createHash('sha256')
    .update(`${input.provider}|${input.voiceId}|${input.speechRate}|${input.text}`)
    .digest('hex')
  return hash.slice(0, 32)
}

export async function readCachedAudio(cacheKey: string): Promise<Buffer | null> {
  const row = await prisma.announcerAudioCache.findUnique({ where: { cacheKey } })
  if (!row) return null
  try {
    return await readFile(row.filePath)
  } catch {
    return null
  }
}

export async function writeCachedAudio(input: {
  cacheKey: string
  provider: string
  voiceId: string
  speechRate: number
  text: string
  mimeType: string
  buffer: Buffer
}): Promise<string> {
  await mkdir(CACHE_ROOT, { recursive: true })
  const ext = input.mimeType.includes('mpeg') ? 'mp3' : 'wav'
  const filePath = path.join(CACHE_ROOT, `${input.cacheKey}.${ext}`)
  await writeFile(filePath, input.buffer)
  const textHash = createHash('sha256').update(input.text).digest('hex')
  await prisma.announcerAudioCache.upsert({
    where: { cacheKey: input.cacheKey },
    create: {
      cacheKey: input.cacheKey,
      provider: input.provider,
      voiceId: input.voiceId,
      speechRate: input.speechRate,
      textHash,
      mimeType: input.mimeType,
      filePath,
    },
    update: { filePath, mimeType: input.mimeType },
  })
  return filePath
}
