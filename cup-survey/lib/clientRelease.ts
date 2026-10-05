import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CLIENT_RELEASE_EPOCH } from '@/lib/clientReleaseConstants'

const STYLE_FINGERPRINT_FILES = [
  'app/globals.css',
  'styles/base.css',
  'styles/modals.css',
  'components/tournament/brackets/bracket.css',
]

function hashStyleSources(): string {
  const hash = createHash('sha256')

  for (const relPath of STYLE_FINGERPRINT_FILES) {
    const absPath = join(process.cwd(), relPath)
    if (existsSync(absPath)) {
      hash.update(relPath)
      hash.update(readFileSync(absPath))
    }
  }

  return hash.digest('hex').slice(0, 12)
}

function getReleaseFingerprint(): string {
  const deployRelease = process.env.CUP_RELEASE_ID?.trim()
  if (deployRelease) return deployRelease

  const buildIdPath = join(process.cwd(), '.next/BUILD_ID')
  if (existsSync(buildIdPath)) {
    const buildId = readFileSync(buildIdPath, 'utf8').trim()
    if (buildId) return `build-${buildId}`
  }

  return `dev-styles-${hashStyleSources()}`
}

export function getClientReleaseId(): string {
  return `${CLIENT_RELEASE_EPOCH}-${getReleaseFingerprint()}`
}
