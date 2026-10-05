import type { APIRequestContext, Page } from '@playwright/test'
import {
  ADMIN_COOKIE_NAME,
  createAdminSession,
  createMatOperatorSession,
  getAdminCookieOptions,
} from '../../../lib/auth'

function adminPassword() {
  return process.env.E2E_ADMIN_PASSWORD ?? 'admin'
}

function matOperatorPassword() {
  return process.env.E2E_MAT_OPERATOR_PASSWORD ?? adminPassword()
}

async function setSessionCookie(page: Page, token: string) {
  const cookieOptions = getAdminCookieOptions()
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
  const hostname = new URL(baseURL).hostname

  await page.context().addCookies([
    {
      name: ADMIN_COOKIE_NAME,
      value: token,
      domain: hostname,
      path: cookieOptions.path,
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: 'Lax',
    },
  ])
}

async function loginViaApi(
  request: APIRequestContext,
  password: string,
  mode?: 'operator',
): Promise<boolean> {
  const response = await request.post('/api/admin/login', {
    data: mode === 'operator' ? { password, mode: 'operator' } : { password },
  })
  return response.ok()
}

async function verifyAdminAuthenticated(request: APIRequestContext): Promise<boolean> {
  const response = await request.get('/api/admin/login')
  if (!response.ok()) {
    return false
  }
  const body = (await response.json()) as { authenticated?: boolean }
  return body.authenticated === true
}

async function verifyMatControlAuthenticated(request: APIRequestContext): Promise<boolean> {
  const response = await request.get('/api/admin/bouts/mats/1/control')
  return response.status() !== 401
}

async function loginViaSessionToken(page: Page, role: 'admin' | 'mat_operator'): Promise<boolean> {
  if (!process.env.ADMIN_SESSION_SECRET) {
    return false
  }

  const token =
    role === 'admin' ? await createAdminSession() : await createMatOperatorSession()
  await setSessionCookie(page, token)
  return role === 'admin'
    ? await verifyAdminAuthenticated(page.request)
    : await verifyMatControlAuthenticated(page.request)
}

export async function loginAsAdmin(request: APIRequestContext): Promise<boolean> {
  if (await loginViaApi(request, adminPassword())) {
    return true
  }
  return false
}

export async function loginAsMatOperator(request: APIRequestContext): Promise<boolean> {
  if (await loginViaApi(request, matOperatorPassword(), 'operator')) {
    return true
  }
  return false
}

export async function loginAdminPage(page: Page): Promise<boolean> {
  if (await loginViaApi(page.request, adminPassword())) {
    return verifyAdminAuthenticated(page.request)
  }
  return loginViaSessionToken(page, 'admin')
}

export async function loginMatOperatorPage(page: Page): Promise<boolean> {
  if (await loginViaApi(page.request, matOperatorPassword(), 'operator')) {
    return verifyMatControlAuthenticated(page.request)
  }
  return loginViaSessionToken(page, 'mat_operator')
}
