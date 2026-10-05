import { describe, expect, it } from 'vitest'
import {
  createAdminSession,
  createMatOperatorSession,
  getSessionRoleFromToken,
  verifyAdminSessionToken,
  verifyMatControlSessionToken,
} from '../../auth'

describe('admin session roles', () => {
  it('creates admin and operator tokens with distinct roles', async () => {
    const adminToken = await createAdminSession()
    const operatorToken = await createMatOperatorSession()

    expect(await getSessionRoleFromToken(adminToken)).toBe('admin')
    expect(await getSessionRoleFromToken(operatorToken)).toBe('mat_operator')
  })

  it('allows mat control for admin and operator only', async () => {
    const adminToken = await createAdminSession()
    const operatorToken = await createMatOperatorSession()

    expect(await verifyAdminSessionToken(adminToken)).toBe(true)
    expect(await verifyAdminSessionToken(operatorToken)).toBe(false)
    expect(await verifyMatControlSessionToken(adminToken)).toBe(true)
    expect(await verifyMatControlSessionToken(operatorToken)).toBe(true)
  })
})
