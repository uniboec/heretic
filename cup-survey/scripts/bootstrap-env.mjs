import fs from 'fs'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import path from 'path'
import { fileURLToPath } from 'url'
import { writeAdminPasswordHashToEnvFile } from './admin-password-env.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const envPath = path.join(root, '.env')
const examplePath = path.join(root, '.env.example')

const DEFAULT_ADMIN_PASSWORD = 'admin'

let content = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, 'utf8')
  : fs.readFileSync(examplePath, 'utf8')

let created = !fs.existsSync(envPath)
let generatedSecret = false
let generatedPassword = false

if (!/ADMIN_SESSION_SECRET=["']?.+\S/.test(content)) {
  const secret = crypto.randomBytes(32).toString('hex')
  content = content.replace(
    /ADMIN_SESSION_SECRET=.*/,
    `ADMIN_SESSION_SECRET="${secret}"`,
  )
  generatedSecret = true
}

if (!/ADMIN_PASSWORD_HASH_B64=\S/.test(content) && !/ADMIN_PASSWORD_HASH=['"]?\$2/.test(content)) {
  const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12)
  if (fs.existsSync(envPath)) {
    writeAdminPasswordHashToEnvFile(envPath, hash)
    content = fs.readFileSync(envPath, 'utf8')
  } else {
    content = content.replace(
      /ADMIN_PASSWORD_HASH=.*/,
      `ADMIN_PASSWORD_HASH='${hash.replace(/\$/g, () => '$$')}'`,
    )
  }
  generatedPassword = true
}

if (process.platform === 'win32' && /@localhost:5433/.test(content)) {
  content = content.replace(
    /(@)localhost(:5433)/g,
    '$1127.0.0.1$2',
  )
  console.log('[env] DATABASE_URL: localhost -> 127.0.0.1 (Windows + Prisma)')
}

if (!/^EDGE_TTS_URL=/.test(content)) {
  content += '\nEDGE_TTS_URL="http://127.0.0.1:5500"\n'
  console.log('[env] Added EDGE_TTS_URL for local TTS server')
}

fs.writeFileSync(envPath, content, 'utf8')

if (created) {
  console.log('[env] Created .env from .env.example')
}
if (generatedSecret) {
  console.log('[env] Generated ADMIN_SESSION_SECRET')
}
if (generatedPassword) {
  console.log(`[env] Default admin password: ${DEFAULT_ADMIN_PASSWORD}`)
}
