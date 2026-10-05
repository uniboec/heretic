import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

export function hashToB64(hash) {
  return Buffer.from(hash, 'utf8').toString('base64')
}

export function b64ToHash(b64) {
  return Buffer.from(b64.trim(), 'base64').toString('utf8')
}

/** Legacy Docker Compose escaping — kept for reading old .env files. */
export function escapeEnvHash(hash) {
  return hash.replace(/\$/g, () => '$$')
}

export function normalizeAdminPasswordHash(raw) {
  if (!raw) return undefined
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '')
  return trimmed.replace(/\$\$/g, '$')
}

function stripEnvQuotes(value) {
  let v = value.trim()
  if (
    (v.startsWith("'") && v.endsWith("'")) ||
    (v.startsWith('"') && v.endsWith('"'))
  ) {
    v = v.slice(1, -1)
  }
  return v
}

export function readAdminPasswordHashFromEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return undefined
  const content = fs.readFileSync(envPath, 'utf8')

  const b64Match = content.match(/^ADMIN_PASSWORD_HASH_B64=(.*)$/m)
  if (b64Match) {
    const b64 = stripEnvQuotes(b64Match[1])
    if (b64) return b64ToHash(b64)
  }

  const match = content.match(/^ADMIN_PASSWORD_HASH=(.*)$/m)
  if (!match) return undefined
  return normalizeAdminPasswordHash(stripEnvQuotes(match[1]))
}

export function writeAdminPasswordHashToEnvFile(envPath, hash) {
  const b64 = hashToB64(hash)
  const examplePath = path.join(path.dirname(envPath), '.env.example')
  let content = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf8')
    : fs.readFileSync(examplePath, 'utf8')

  const line = `ADMIN_PASSWORD_HASH_B64=${b64}`
  if (/^ADMIN_PASSWORD_HASH_B64=.*/m.test(content)) {
    content = content.replace(/^ADMIN_PASSWORD_HASH_B64=.*/m, () => line)
  } else {
    content = `${content.trimEnd()}\n${line}\n`
  }

  if (/^ADMIN_PASSWORD_HASH=.*/m.test(content)) {
    content = content.replace(/^ADMIN_PASSWORD_HASH=.*\n?/m, '')
  }

  fs.writeFileSync(envPath, content, 'utf8')
}
