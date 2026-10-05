import { withBasePath } from '@/lib/basePath'
import { downloadBracketWordExport as runDownloadBracketWordExport } from './wordExportClient'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import {
  formatBracketApiError,
  formatBracketConflictMessage,
  formatValidationIssueMessage,
} from '@/lib/brackets/labels'
import type {
  AdminBracketsDashboardLite,
  AdminCategoryStructureResponse,
  BracketBackupSummary,
  DraftMutationInput,
  DraftMutationResponse,
  ImpactPreviewInput,
  ImpactPreviewResponse,
  LiveMutationResponse,
  VisibilityMutationResponse,
} from './types'

export type BracketAdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; code?: string }

async function bracketAdminRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<BracketAdminResult<T>> {
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

  const firstError =
    Array.isArray(body?.errors) && body.errors[0] && typeof body.errors[0] === 'object'
      ? (body.errors[0] as { code?: string; message?: string })
      : undefined

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
    code:
      typeof body?.code === 'string'
        ? body.code
        : typeof firstError?.code === 'string'
          ? firstError.code
          : undefined,
  }
}

export async function fetchAdminBracketsDashboard(): Promise<BracketAdminResult<AdminBracketsDashboardLite>> {
  return bracketAdminRequest<AdminBracketsDashboardLite>('/api/admin/brackets')
}

export async function fetchAdminCategoryStructure(
  categoryKey: string,
  options?: { live?: boolean },
): Promise<BracketAdminResult<AdminCategoryStructureResponse>> {
  const query = options?.live ? '?live=1' : ''
  return bracketAdminRequest<AdminCategoryStructureResponse>(
    `/api/admin/brackets/categories/${encodeURIComponent(categoryKey)}/structure${query}`,
  )
}

export async function syncBrackets(input: DraftMutationInput & {
  scope: 'all' | 'category'
  categoryKey?: string
}): Promise<BracketAdminResult<DraftMutationResponse>> {
  return bracketAdminRequest('/api/admin/brackets/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, mode: 'SYNC' }),
  })
}

export async function redrawBrackets(input: DraftMutationInput & {
  scope: 'all' | 'category'
  categoryKey?: string
  onlyStale?: boolean
}): Promise<BracketAdminResult<DraftMutationResponse>> {
  return bracketAdminRequest('/api/admin/brackets/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, mode: 'REDRAW' }),
  })
}

export async function fetchImpactPreview(
  input: ImpactPreviewInput,
): Promise<BracketAdminResult<ImpactPreviewResponse>> {
  return bracketAdminRequest('/api/admin/brackets/impact-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function resetBrackets(input: {
  expectedVersion: number
  impactToken: string
}): Promise<BracketAdminResult<LiveMutationResponse>> {
  return bracketAdminRequest('/api/admin/brackets/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function forceRebuildBrackets(input: {
  expectedVersion: number
  impactToken: string
  categoryKeys: string[]
}): Promise<BracketAdminResult<LiveMutationResponse>> {
  return bracketAdminRequest('/api/admin/brackets/force-rebuild', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function listBackups(): Promise<BracketAdminResult<{ backups: BracketBackupSummary[] }>> {
  return bracketAdminRequest('/api/admin/brackets/backup')
}

export async function createBackup(
  input?: { label?: string },
): Promise<BracketAdminResult<{ backup: BracketBackupSummary }>> {
  return bracketAdminRequest('/api/admin/brackets/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  })
}

export async function restoreBackup(input: {
  backupId: string
  expectedVersion: number
  impactToken: string
}): Promise<BracketAdminResult<LiveMutationResponse>> {
  return bracketAdminRequest(
    `/api/admin/brackets/backup/${encodeURIComponent(input.backupId)}/restore`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: input.expectedVersion,
        impactToken: input.impactToken,
      }),
    },
  )
}

export async function setBracketVisibility(input: {
  scope: 'all' | 'category'
  categoryKey?: string
  visible: boolean
}): Promise<BracketAdminResult<VisibilityMutationResponse>> {
  return bracketAdminRequest('/api/admin/brackets/visibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function setBoutsRelease(input: {
  scope: 'category' | 'ready' | 'all'
  categoryKey?: string
  released: boolean
  expectedPublishedDrawId?: string
  expectedPublishedGenerationId: string
  expectedScheduleVersion?: number
}): Promise<
  BracketAdminResult<{
    ok: true
    noop?: boolean
    affectedCategoryKeys: string[]
    scheduleVersion?: number
  }>
> {
  return bracketAdminRequest('/api/admin/brackets/bouts-release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function updateBracketDraw(
  drawId: string,
  input: DraftMutationInput & Record<string, unknown>,
): Promise<BracketAdminResult<DraftMutationResponse>> {
  return bracketAdminRequest(`/api/admin/brackets/draws/${drawId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function moveBracketEntry(
  input: DraftMutationInput & { entryId: string; targetCategoryKey: string },
): Promise<BracketAdminResult<DraftMutationResponse>> {
  return bracketAdminRequest('/api/admin/brackets/move-entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function resetBracketEntryPlacement(
  entryId: string,
  input: DraftMutationInput,
): Promise<BracketAdminResult<DraftMutationResponse>> {
  return bracketAdminRequest(`/api/admin/brackets/move-entry/${entryId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function patchBracketSettings(
  body: Record<string, unknown>,
): Promise<BracketAdminResult<{ draft?: { id: string; version: number } }>> {
  return bracketAdminRequest('/api/admin/brackets/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function previewConsolidationBrackets(input: {
  expectedVersion: number
  policy?: import('../consolidation/types').ConsolidationPolicy
}): Promise<BracketAdminResult<import('./types').ConsolidationPlanPreviewResponse>> {
  return bracketAdminRequest('/api/admin/brackets/consolidation/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function applyConsolidationBrackets(input: {
  expectedVersion: number
  policy: import('../consolidation/types').ConsolidationPolicy
  consolidationPlanToken: string
  impactToken?: string
}): Promise<BracketAdminResult<import('./types').ConsolidationApplyResponse>> {
  return bracketAdminRequest('/api/admin/brackets/consolidation/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

function buildBracketExportUrl(
  format: 'word' | 'pdf',
  categoryKey?: string | null,
  options?: { includeTitlePage?: boolean },
): string {
  const params = new URLSearchParams()
  if (categoryKey) params.set('categoryKey', categoryKey)
  if (options?.includeTitlePage) params.set('includeTitlePage', '1')
  const query = params.toString()
  return withBasePath(`/api/admin/brackets/export/${format}${query ? `?${query}` : ''}`)
}

export function buildBracketWordExportUrl(
  categoryKey?: string | null,
  options?: { includeTitlePage?: boolean },
): string {
  return buildBracketExportUrl('word', categoryKey, options)
}

export function buildBracketPdfExportUrl(
  categoryKey?: string | null,
  options?: { includeTitlePage?: boolean },
): string {
  return buildBracketExportUrl('pdf', categoryKey, options)
}

export async function downloadBracketWordExport(input: {
  categoryKey?: string | null
  includeTitlePage?: boolean
  onStart?: () => void
  onDone?: () => void
  onError?: (message: string) => void
}): Promise<void> {
  return runDownloadBracketWordExport({
    ...input,
    buildUrl: (categoryKey) =>
      buildBracketWordExportUrl(categoryKey, { includeTitlePage: input.includeTitlePage }),
  })
}

export async function downloadBracketPdfExport(input: {
  categoryKey?: string | null
  includeTitlePage?: boolean
  onStart?: () => void
  onDone?: () => void
  onError?: (message: string) => void
}): Promise<void> {
  return runDownloadBracketWordExport({
    ...input,
    buildUrl: (categoryKey) =>
      buildBracketPdfExportUrl(categoryKey, { includeTitlePage: input.includeTitlePage }),
    defaultFilename: (categoryKey) =>
      categoryKey ? `setka-${categoryKey}.pdf` : 'setki-sudyam.pdf',
  })
}
