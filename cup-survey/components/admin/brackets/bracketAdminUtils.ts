import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import {
  formatBracketApiError,
  formatBracketConflictMessage,
  formatParticipantCount,
  formatValidationIssueMessage,
} from '@/lib/brackets/labels'

export {
  BRONZE_MODE_LABELS,
  CATEGORY_STATUS_LABELS,
  STATUS_REASON_LABELS,
  SYSTEM_LABELS,
  formatAllowedSystemIds,
  formatBracketApiError,
  formatBracketConflictMessage,
  formatBronzeModeLabel,
  formatCategoryStatusLabel,
  formatFormatRuleLabel,
  formatParticipantCount,
  formatStatusReasonLabel,
  formatSystemLabel,
  formatValidationIssueMessage,
} from '@/lib/brackets/labels'


const DEFAULT_DASHBOARD_SETTINGS = {
  publicEnabled: false,
  includePaid: true,
  includeUnpaid: false,
}

const DEFAULT_DASHBOARD_DIFF = {
  globalCompositionStale: false,
  registrationDataStale: false,
  eligibilityCriteriaStale: false,
}

export interface AdminBracketsDashboardData {
  settings: {
    publicEnabled: boolean
    includePaid: boolean
    includeUnpaid: boolean
  }
  draft: { id: string; version: number } | null
  published: { id: string; publishedAt: string } | null
  controlsEnabled: boolean
  features?: {
    independentBoutsRelease: boolean
  }
  autoSyncFailures: Array<{
    categoryKey: string
    errorMessage: string | null
    createdAt: string
  }>
  diff: {
    globalCompositionStale: boolean
    registrationDataStale: boolean
    eligibilityCriteriaStale: boolean
  }
  categories: Array<Record<string, unknown>>
  allCategoryKeys: Array<{ key: string; title: string; participantCount: number }>
  configuredCategoryStages?: number[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function safeCategoryList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export interface CategorySearchParticipant {
  displayName: string
  clubName: string
}

export interface CategorySearchItem {
  title: string
  participants: CategorySearchParticipant[]
}

/** Фильтр категорий по названию, ФИО или клубу участника. */
export function filterCategoriesByQuery<T extends CategorySearchItem>(
  categories: T[],
  query: string,
): T[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return categories

  return categories.filter((category) => {
    if (category.title.toLowerCase().includes(normalized)) return true
    return category.participants.some(
      (participant) =>
        participant.displayName.toLowerCase().includes(normalized) ||
        participant.clubName.toLowerCase().includes(normalized),
    )
  })
}

export function normalizeAdminBracketsDashboard(raw: unknown): AdminBracketsDashboardData {
  const payload = asRecord(raw)
  const settingsRaw = asRecord(payload?.settings)
  const diffRaw = asRecord(payload?.diff)
  const draftRaw = asRecord(payload?.draft)
  const publishedRaw = asRecord(payload?.published)

  return {
    settings: {
      publicEnabled: Boolean(settingsRaw?.publicEnabled ?? DEFAULT_DASHBOARD_SETTINGS.publicEnabled),
      includePaid: settingsRaw?.includePaid !== false,
      includeUnpaid: Boolean(settingsRaw?.includeUnpaid ?? DEFAULT_DASHBOARD_SETTINGS.includeUnpaid),
    },
    draft:
      draftRaw && typeof draftRaw.id === 'string' && typeof draftRaw.version === 'number'
        ? { id: draftRaw.id, version: draftRaw.version }
        : null,
    published:
      publishedRaw &&
      typeof publishedRaw.id === 'string' &&
      typeof publishedRaw.publishedAt === 'string'
        ? { id: publishedRaw.id, publishedAt: publishedRaw.publishedAt }
        : null,
    controlsEnabled: Boolean(payload?.controlsEnabled),
    features: (() => {
      const featuresRaw = asRecord(payload?.features)
      return {
        independentBoutsRelease: Boolean(featuresRaw?.independentBoutsRelease),
      }
    })(),
    autoSyncFailures: Array.isArray(payload?.autoSyncFailures)
      ? payload.autoSyncFailures
          .map((item) => {
            const record = asRecord(item)
            if (!record?.categoryKey || typeof record.createdAt !== 'string') return null
            return {
              categoryKey: String(record.categoryKey),
              errorMessage:
                typeof record.errorMessage === 'string' ? record.errorMessage : null,
              createdAt: record.createdAt,
            }
          })
          .filter(
            (
              item,
            ): item is {
              categoryKey: string
              errorMessage: string | null
              createdAt: string
            } => Boolean(item),
          )
      : [],
    diff: {
      globalCompositionStale: Boolean(
        diffRaw?.globalCompositionStale ?? DEFAULT_DASHBOARD_DIFF.globalCompositionStale,
      ),
      registrationDataStale: Boolean(
        diffRaw?.registrationDataStale ?? DEFAULT_DASHBOARD_DIFF.registrationDataStale,
      ),
      eligibilityCriteriaStale: Boolean(
        diffRaw?.eligibilityCriteriaStale ?? DEFAULT_DASHBOARD_DIFF.eligibilityCriteriaStale,
      ),
    },
    categories: safeCategoryList(payload?.categories),
    configuredCategoryStages: Array.isArray(payload?.configuredCategoryStages)
      ? (payload.configuredCategoryStages as number[])
      : [1],
    allCategoryKeys: Array.isArray(payload?.allCategoryKeys)
      ? payload.allCategoryKeys
          .map((item) => {
            const record = asRecord(item)
            if (!record?.key || !record?.title) return null
            return {
              key: String(record.key),
              title: String(record.title),
              participantCount:
                typeof record.participantCount === 'number' ? record.participantCount : 0,
            }
          })
          .filter((item): item is { key: string; title: string; participantCount: number } =>
            Boolean(item),
          )
      : [],
  }
}

export async function bracketAdminFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string; code?: string }> {
  const res = await fetch(withBasePath(url), init)
  const result = await readJsonResponse<T>(res)
  if (result.ok) {
    return { ok: true, data: result.data }
  }

  const body =
    result.body && typeof result.body === 'object'
      ? (result.body as Record<string, unknown>)
      : null

  if (result.status === 409) {
    return {
      ok: false,
      status: 409,
      code: typeof body?.code === 'string' ? body.code : undefined,
      message: formatBracketConflictMessage(
        typeof body?.code === 'string' ? body.code : undefined,
      ),
    }
  }

  const message =
    Array.isArray(body?.errors)
      ? body.errors
          .map((issue) =>
            formatValidationIssueMessage(
              issue as { code: string; message?: string },
            ),
          )
          .join('\n')
      : formatBracketApiError(result.error ?? null)

  return {
    ok: false,
    status: result.status,
    message,
    code: typeof body?.code === 'string' ? body.code : undefined,
  }
}
