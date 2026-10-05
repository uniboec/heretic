import { BASE_PATH } from './basePath'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const ADMIN_COOKIE_NAME = 'cup26_admin_session'

export type AdminSessionRole = 'admin' | 'mat_operator'

export function normalizeAdminPasswordHash(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '')
  return trimmed.replace(/\$\$/g, '$')
}

export function getAdminPasswordHash(): string | undefined {
  const b64 = process.env.ADMIN_PASSWORD_HASH_B64?.trim()
  if (b64) {
    try {
      return Buffer.from(b64, 'base64').toString('utf8')
    } catch {
      return undefined
    }
  }
  return normalizeAdminPasswordHash(process.env.ADMIN_PASSWORD_HASH)
}

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export function getMatOperatorPasswordHash(): string | undefined {
  const b64 = process.env.MAT_OPERATOR_PASSWORD_HASH_B64?.trim()
  if (b64) {
    try {
      return Buffer.from(b64, 'base64').toString('utf8')
    } catch {
      return undefined
    }
  }
  return normalizeAdminPasswordHash(process.env.MAT_OPERATOR_PASSWORD_HASH)
}

async function createSession(role: AdminSessionRole): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret())
}

export async function createAdminSession(): Promise<string> {
  return createSession('admin')
}

export async function createMatOperatorSession(): Promise<string> {
  return createSession('mat_operator')
}

export async function getSessionRoleFromToken(token: string): Promise<AdminSessionRole | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.role === 'mat_operator') return 'mat_operator'
    return 'admin'
  } catch {
    return null
  }
}

export async function verifyAdminSessionToken(token: string): Promise<boolean> {
  const role = await getSessionRoleFromToken(token)
  return role === 'admin'
}

export async function verifyMatControlSessionToken(token: string): Promise<boolean> {
  const role = await getSessionRoleFromToken(token)
  return role === 'admin' || role === 'mat_operator'
}

export async function verifyAdminSession(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return false
  return verifyAdminSessionToken(token)
}

export async function verifyMatControlSession(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return false
  return verifyMatControlSessionToken(token)
}

export async function getAdminSessionRole(): Promise<AdminSessionRole | null> {
  if (process.env.CUP_SURVEY_SCRIPT_MODE === '1') return 'admin'
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) return null
  return getSessionRoleFromToken(token)
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: BASE_PATH || '/',
    maxAge: 60 * 60 * 24,
  }
}

export async function getAdminTokenFromRequest(request: NextRequest): Promise<string | null> {
  return request.cookies.get(ADMIN_COOKIE_NAME)?.value ?? null
}

export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const token = await getAdminTokenFromRequest(request)
  if (!token) return false
  return verifyAdminSessionToken(token)
}

export async function isMatControlRequest(request: NextRequest): Promise<boolean> {
  const token = await getAdminTokenFromRequest(request)
  if (!token) return false
  return verifyMatControlSessionToken(token)
}
