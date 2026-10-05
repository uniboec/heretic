import 'server-only'

import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { withBasePath } from '@/lib/basePath'
import type { CueSoundDefinition } from './cueCatalog'

export const CUSTOM_CUE_MAX_BYTES = 5 * 1024 * 1024
export const CUSTOM_CUE_ALLOWED_MIME = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
] as const

type CustomCueManifestEntry = {
  id: string
  label: string
  family: CueSoundDefinition['family']
  fileName: string
  durationMs: number
}

type CustomCueManifest = {
  cues: CustomCueManifestEntry[]
}

function getCueRoot(scopeId: string): string {
  const base = process.env.ANNOUNCER_CUES_DIR ?? path.join(process.cwd(), 'data', 'announcer-cues')
  return path.join(base, scopeId)
}

function manifestPath(scopeId: string): string {
  return path.join(getCueRoot(scopeId), 'manifest.json')
}

function normalizeCueMime(mimeType: string, fileName?: string): string {
  const normalized = mimeType.trim().toLowerCase()
  if (CUSTOM_CUE_ALLOWED_MIME.includes(normalized as (typeof CUSTOM_CUE_ALLOWED_MIME)[number])) {
    return normalized
  }
  const ext = fileName?.split('.').pop()?.toLowerCase()
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'wav') return 'audio/wav'
  return normalized
}

async function readManifest(scopeId: string): Promise<CustomCueManifest> {
  try {
    const raw = await readFile(manifestPath(scopeId), 'utf8')
    const parsed = JSON.parse(raw) as CustomCueManifest
    if (!Array.isArray(parsed.cues)) return { cues: [] }
    return parsed
  } catch {
    return { cues: [] }
  }
}

async function writeManifest(scopeId: string, manifest: CustomCueManifest): Promise<void> {
  const root = getCueRoot(scopeId)
  await mkdir(root, { recursive: true })
  await writeFile(manifestPath(scopeId), JSON.stringify(manifest, null, 2), 'utf8')
}

export async function listCustomCueSounds(scopeId: string): Promise<CueSoundDefinition[]> {
  const manifest = await readManifest(scopeId)
  return manifest.cues.map((entry) => ({
    id: entry.id,
    label: entry.label,
    family: entry.family,
    path: withBasePath(`/api/admin/announcer/cues/${entry.id}/audio`),
    durationMs: entry.durationMs,
  }))
}

export async function getCustomCueSound(
  scopeId: string,
  id: string,
): Promise<CueSoundDefinition | undefined> {
  const manifest = await readManifest(scopeId)
  const entry = manifest.cues.find((cue) => cue.id === id)
  if (!entry) return undefined
  return {
    id: entry.id,
    label: entry.label,
    family: entry.family,
    path: withBasePath(`/api/admin/announcer/cues/${entry.id}/audio`),
    durationMs: entry.durationMs,
  }
}

export async function readCustomCueFile(
  scopeId: string,
  cueId: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const manifest = await readManifest(scopeId)
  const entry = manifest.cues.find((cue) => cue.id === cueId)
  if (!entry) return null
  const filePath = path.join(getCueRoot(scopeId), entry.fileName)
  const buffer = await readFile(filePath)
  const ext = entry.fileName.split('.').pop()?.toLowerCase()
  const mimeType = ext === 'mp3' ? 'audio/mpeg' : 'audio/wav'
  return { buffer, mimeType }
}

export async function saveCustomCueFile(input: {
  scopeId: string
  buffer: Buffer
  mimeType: string
  originalFileName?: string
  label: string
  family: CueSoundDefinition['family']
  durationMs: number
}): Promise<CueSoundDefinition> {
  const resolvedMime = normalizeCueMime(input.mimeType, input.originalFileName)
  if (!CUSTOM_CUE_ALLOWED_MIME.includes(resolvedMime as (typeof CUSTOM_CUE_ALLOWED_MIME)[number])) {
    throw new Error('INVALID_FILE_TYPE')
  }
  if (input.buffer.byteLength > CUSTOM_CUE_MAX_BYTES) {
    throw new Error('FILE_TOO_LARGE')
  }

  const id = `custom-${randomUUID()}`
  const ext = resolvedMime.includes('wav') ? 'wav' : 'mp3'
  const fileName = `${id}.${ext}`
  const root = getCueRoot(input.scopeId)
  await mkdir(root, { recursive: true })
  await writeFile(path.join(root, fileName), input.buffer)

  const manifest = await readManifest(input.scopeId)
  const entry: CustomCueManifestEntry = {
    id,
    label: input.label.trim() || 'Свой сигнал',
    family: input.family,
    fileName,
    durationMs: Math.max(0, Math.round(input.durationMs)),
  }
  manifest.cues.push(entry)
  await writeManifest(input.scopeId, manifest)

  return {
    id: entry.id,
    label: entry.label,
    family: entry.family,
    path: withBasePath(`/api/admin/announcer/cues/${entry.id}/audio`),
    durationMs: entry.durationMs,
  }
}
