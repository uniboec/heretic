import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import {
  ADMIN_COOKIE_NAME,
  createAdminSession,
  createMatOperatorSession,
  getAdminCookieOptions,
  getAdminPasswordHash,
  getMatOperatorPasswordHash,
  verifyAdminSession,
} from '@/lib/auth'

export async function POST(request: Request) {
  const body = await request.json()
  const password = String(body.password ?? '').trim()
  const mode = body.mode === 'operator' ? 'operator' : 'admin'

  if (mode === 'operator') {
    const operatorHash = getMatOperatorPasswordHash()
    if (!operatorHash) {
      return NextResponse.json({ error: 'Оператор ковра не настроен' }, { status: 500 })
    }
    const valid = await bcrypt.compare(password, operatorHash)
    if (!valid) {
      return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 })
    }
    const token = await createMatOperatorSession()
    const response = NextResponse.json({ success: true, role: 'mat_operator' })
    response.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions())
    return response
  }

  const hash = getAdminPasswordHash()
  if (!hash) {
    return NextResponse.json({ error: 'Admin not configured' }, { status: 500 })
  }

  const valid = await bcrypt.compare(password, hash)
  if (!valid) {
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 })
  }

  const token = await createAdminSession()
  const response = NextResponse.json({ success: true })
  response.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions())
  return response
}

export async function GET() {
  const ok = await verifyAdminSession()
  return NextResponse.json({ authenticated: ok })
}
