import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'

export async function requireAnnouncerAdmin() {
  if (!(await verifyAdminSession())) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: BRACKET_API_ERROR_LABELS.Unauthorized },
        { status: 401 },
      ),
    }
  }
  return { ok: true as const }
}
