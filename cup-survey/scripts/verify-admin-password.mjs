import bcrypt from 'bcryptjs'
import { readAdminPasswordHashFromEnvFile } from './admin-password-env.mjs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const password = process.argv[2] ?? '336699Ub'
const hash = readAdminPasswordHashFromEnvFile(path.join(root, '.env'))

if (!hash) {
  console.error('ADMIN_PASSWORD_HASH_B64 not found in .env')
  process.exit(1)
}

const valid = await bcrypt.compare(password, hash)
console.log(valid ? 'OK' : 'FAIL')
