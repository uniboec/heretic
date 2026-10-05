import { verifyMatControlSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { MatSessionAcquireSchema } from '@/lib/bouts/matControlSchemas'
import {
  acquireMatSession,
  heartbeatMatSession,
  releaseMatSession,
  takeoverMatSession,
} from '@/lib/bouts/matControlService'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LeaseActionSchema = z.enum(['acquire', 'heartbeat', 'release', 'takeover'])

function parseMatIndex(matIndex: string): number | null {
  const parsed = Number.parseInt(matIndex, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return null
  return parsed
}

export async function POST(
  request: Request,
  context: { params: Promise<{ matIndex: string; action: string }> },
) {
  if (!(await verifyMatControlSession())) {
    return matControlJson({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, 401)
  }

  try {
    const { matIndex, action } = await context.params
    const parsedMat = parseMatIndex(matIndex)
    if (parsedMat == null) {
      return matControlJson({ error: 'Invalid matIndex' }, 400)
    }

    const parsedAction = LeaseActionSchema.safeParse(action)
    if (!parsedAction.success) {
      return matControlJson({ error: 'Unknown lease action' }, 404)
    }

    const body = await request.json().catch(() => null)
    if (body == null) {
      return matControlJson({ error: 'Пустое тело запроса' }, 400)
    }
    const parsedBody = MatSessionAcquireSchema.safeParse(body)
    if (!parsedBody.success) {
      return matControlJson(
        { errors: parsedBody.error.issues.map((issue) => ({ message: issue.message })) },
        400,
      )
    }

    const holderToken = parsedBody.data.holderToken
    switch (parsedAction.data) {
      case 'acquire':
        return matControlJson(await acquireMatSession(parsedMat, holderToken))
      case 'heartbeat':
        return matControlJson(await heartbeatMatSession(parsedMat, holderToken))
      case 'release':
        return matControlJson(await releaseMatSession(parsedMat, holderToken))
      case 'takeover':
        return matControlJson(await takeoverMatSession(parsedMat, holderToken))
    }
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
