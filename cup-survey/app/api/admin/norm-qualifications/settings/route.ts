import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { NormQualificationSettingsPatchSchema } from '@/lib/rankQualifications/schemas'
import {
  getNormQualificationSettings,
  updateNormQualificationSettings,
} from '@/lib/rankQualifications/settings'

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  const settings = await getNormQualificationSettings()
  return NextResponse.json({ settings })
}

export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = NormQualificationSettingsPatchSchema.parse(body)
    const settings = await updateNormQualificationSettings({
      publicEnabled: parsed.publicEnabled,
    })
    return NextResponse.json({ settings })
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
