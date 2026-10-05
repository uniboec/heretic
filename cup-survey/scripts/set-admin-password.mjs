import bcrypt from 'bcryptjs'
import { readAdminPasswordHashFromEnvFile, writeAdminPasswordHashToEnvFile } from './admin-password-env.mjs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const password = process.argv[2]

if (!password) {
  console.error('Usage: npm run set-admin-password -- <password>')
  process.exit(1)
}

const envPath = path.join(root, '.env')
const hash = await bcrypt.hash(password, 12)
writeAdminPasswordHashToEnvFile(envPath, hash)

const stored = readAdminPasswordHashFromEnvFile(envPath)
const valid = stored ? await bcrypt.compare(password, stored) : false

if (!valid) {
  console.error('Failed to verify written admin password hash')
  process.exit(1)
}

console.log(`Admin password updated in ${envPath}`)
