import { verifyAdminSession } from '@/lib/auth'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import {
  getMatControlAuditDashboard,
  recordMatControlAuditFindings,
  scanMatControlAuditFindings,
} from '@/lib/bouts/matControlAudit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  if (!(await verifyAdminSession())) {
    return matControlJson({ error: 'Unauthorized' }, 401)
  }

  try {
    const dashboard = await getMatControlAuditDashboard()
    return matControlJson(dashboard)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return matControlJson({ error: 'Unauthorized' }, 401)
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string }
    if (body.action === 'scan') {
      const findings = await scanMatControlAuditFindings(200)
      const created = await recordMatControlAuditFindings(findings)
      return matControlJson({ findings, createdCount: created.length })
    }
    return matControlJson({ error: 'Unknown action' }, 400)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
