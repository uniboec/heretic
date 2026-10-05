'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAdminBracketsDashboard,
  fetchAdminCategoryStructure,
  moveBracketEntry,
  patchBracketSettings,
  redrawBrackets,
  resetBracketEntryPlacement,
  setBracketVisibility,
  setBoutsRelease,
  syncBrackets,
  updateBracketDraw,
  type BracketAdminResult,
} from './api'
import { applyDraftMutationToDashboard, type DashboardCacheSnapshot } from './cacheUpdate'
import { bracketAdminQueryKeys } from './queryKeys'
import type {
  AdminBracketsDashboardLite,
  AdminCategoryStructureResponse,
  DraftMutationInput,
  DraftMutationResponse,
  VisibilityMutationResponse,
} from './types'
import { normalizeAdminBracketsDashboard, safeCategoryList } from '@/components/admin/brackets/bracketAdminUtils'
import type { CategoryPanelData } from '@/components/admin/brackets/AdminBracketCategoryPanel'

function unwrapResult<T>(result: BracketAdminResult<T>): T {
  if (!result.ok) {
    throw new Error(result.message)
  }
  return result.data
}

function normalizeDashboard(raw: AdminBracketsDashboardLite) {
  const normalized = normalizeAdminBracketsDashboard(raw)
  const categories = safeCategoryList<CategoryPanelData>(normalized.categories).filter(
    (category) => category.participants.length > 0,
  )
  return {
    ...normalized,
    categories,
  }
}

export type NormalizedDashboard = ReturnType<typeof normalizeDashboard>

function hasPartialDashboardUpdate(data: unknown): data is DraftMutationResponse {
  if (!data || typeof data !== 'object') return false
  const payload = data as DraftMutationResponse
  return (
    Boolean(payload.category) ||
    Boolean(payload.categories?.length) ||
    Boolean(payload.replaceCategories)
  )
}

export function useAdminBracketsDashboard() {
  return useQuery({
    queryKey: bracketAdminQueryKeys.dashboard(),
    queryFn: async () => {
      const raw = unwrapResult(await fetchAdminBracketsDashboard())
      return normalizeDashboard(raw)
    },
  })
}

export function useAdminCategoryStructure(
  categoryKey: string | null,
  enabled = true,
  options?: { live?: boolean },
) {
  const live = options?.live ?? false
  return useQuery({
    queryKey: [...bracketAdminQueryKeys.structure(categoryKey ?? ''), live ? 'live' : 'draft'],
    queryFn: async () =>
      unwrapResult(
        await fetchAdminCategoryStructure(categoryKey!, { live }),
      ) as AdminCategoryStructureResponse,
    enabled: Boolean(categoryKey) && enabled,
  })
}

function useInvalidateBrackets() {
  const queryClient = useQueryClient()
  return async (categoryKey?: string | null, options?: { dashboard?: boolean }) => {
    if (options?.dashboard ?? true) {
      await queryClient.invalidateQueries({ queryKey: bracketAdminQueryKeys.dashboard() })
    }
    if (categoryKey) {
      await queryClient.invalidateQueries({
        queryKey: bracketAdminQueryKeys.structure(categoryKey),
      })
    }
  }
}

function useDraftMutation<TInput extends DraftMutationInput, TResult extends DraftMutationResponse>(
  mutationFn: (input: TInput) => Promise<BracketAdminResult<TResult>>,
) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateBrackets()
  return useMutation<TResult, Error, TInput>({
    mutationFn: async (input) => unwrapResult(await mutationFn(input)),
    onSuccess: (data) => {
      if (!hasPartialDashboardUpdate(data)) return
      const previous = queryClient.getQueryData<NormalizedDashboard>(
        bracketAdminQueryKeys.dashboard(),
      )
      const next = applyDraftMutationToDashboard(previous, data)
      if (next) {
        queryClient.setQueryData(bracketAdminQueryKeys.dashboard(), next)
      }
    },
    onSettled: (data, _error, variables) => {
      const categoryKey =
        variables && typeof variables === 'object' && 'categoryKey' in variables
          ? (variables as { categoryKey?: string }).categoryKey ?? null
          : null
      const structureKeys = new Set<string>()
      if (categoryKey) structureKeys.add(categoryKey)
      if (data?.category) structureKeys.add(data.category.categoryKey)
      for (const category of data?.categories ?? []) {
        structureKeys.add(category.categoryKey)
      }

      if (hasPartialDashboardUpdate(data) && !data.replaceCategories) {
        void Promise.all(
          [...structureKeys].map((key) =>
            invalidate(key, { dashboard: false }),
          ),
        )
        return
      }

      void invalidate(categoryKey)
    },
  })
}

export function useSyncBracketsMutation() {
  return useDraftMutation(syncBrackets)
}

export function useRedrawBracketsMutation() {
  return useDraftMutation(redrawBrackets)
}

export function useVisibilityMutation() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateBrackets()
  return useMutation<
    VisibilityMutationResponse,
    Error,
    {
      scope: 'all' | 'category'
      categoryKey?: string
      visible: boolean
    },
    { previous?: NormalizedDashboard }
  >({
    mutationFn: async (input) => unwrapResult(await setBracketVisibility(input)),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: bracketAdminQueryKeys.dashboard() })
      const previous = queryClient.getQueryData<NormalizedDashboard>(
        bracketAdminQueryKeys.dashboard(),
      )
      if (!previous) return { previous }

      const affectedKeys =
        input.scope === 'all'
          ? input.visible
            ? previous.categories
                .filter((category) => category.status === 'ACTIVE')
                .map((category) => category.categoryKey)
            : previous.categories.map((category) => category.categoryKey)
          : input.categoryKey
            ? [input.categoryKey]
            : []

      queryClient.setQueryData<NormalizedDashboard>(bracketAdminQueryKeys.dashboard(), {
        ...previous,
        categories: previous.categories.map((category) => {
          if (!affectedKeys.includes(category.categoryKey)) return category
          const publicationState = category.publicationState ?? {
            categoryKey: category.categoryKey,
            visible: category.publicVisible,
            boutsReleased: category.boutsReleased ?? false,
            matCountAtRelease: null,
            publishedDrawId: null,
            publishedGenerationId: null,
            controlsEnabled: previous.controlsEnabled,
          }
          return {
            ...category,
            publicVisible: input.visible,
            publicationState: {
              ...publicationState,
              visible: input.visible,
            },
          }
        }),
      })

      return { previous }
    },
    onSuccess: (data) => {
      const previous = queryClient.getQueryData<NormalizedDashboard>(
        bracketAdminQueryKeys.dashboard(),
      )
      if (!previous) return

      const stateMap = new Map(
        data.publicationStates.map((state) => [state.categoryKey, state]),
      )
      queryClient.setQueryData<NormalizedDashboard>(bracketAdminQueryKeys.dashboard(), {
        ...previous,
        categories: previous.categories.map((category) => {
          const publicationState = stateMap.get(category.categoryKey)
          if (!publicationState) return category
          return {
            ...category,
            publicVisible: publicationState.visible,
            boutsReleased: publicationState.boutsReleased,
            publicationState,
          }
        }),
      })
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(bracketAdminQueryKeys.dashboard(), context.previous)
      }
    },
    onSettled: () => {
      void invalidate(null, { dashboard: false })
    },
  })
}

export function useUpdateDrawMutation(drawId: string, categoryKey: string) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateBrackets()
  return useMutation<
    DraftMutationResponse,
    Error,
    DraftMutationInput & Record<string, unknown>
  >({
    mutationFn: async (input) => unwrapResult(await updateBracketDraw(drawId, input)),
    onSuccess: (data) => {
      const previous = queryClient.getQueryData<NormalizedDashboard>(
        bracketAdminQueryKeys.dashboard(),
      )
      const next = applyDraftMutationToDashboard(previous, data)
      if (next) {
        queryClient.setQueryData(bracketAdminQueryKeys.dashboard(), next)
      }
    },
    onSettled: (data) => {
      const keys = new Set<string>([categoryKey])
      if (data?.category) keys.add(data.category.categoryKey)
      void Promise.all(
        [...keys].map((key) => invalidate(key, { dashboard: false })),
      )
    },
  })
}

export function useMoveEntryMutation() {
  return useDraftMutation<
    DraftMutationInput & { entryId: string; targetCategoryKey: string },
    DraftMutationResponse
  >(moveBracketEntry)
}

export function useResetEntryMutation() {
  return useDraftMutation<
    DraftMutationInput & { entryId: string },
    DraftMutationResponse
  >(({ entryId, ...input }) => resetBracketEntryPlacement(entryId, input))
}

export function useBoutsReleaseMutation() {
  const invalidate = useInvalidateBrackets()
  return useMutation<
    { ok: true; noop?: boolean; affectedCategoryKeys: string[]; scheduleVersion?: number },
    Error,
    {
      scope: 'category' | 'ready' | 'all'
      categoryKey?: string
      released: boolean
      expectedPublishedDrawId?: string
      expectedPublishedGenerationId: string
      expectedScheduleVersion?: number
    }
  >({
    mutationFn: async (input) => unwrapResult(await setBoutsRelease(input)),
    onSettled: () => {
      void invalidate()
    },
  })
}

export function usePatchBracketSettingsMutation() {
  const invalidate = useInvalidateBrackets()
  return useMutation<{ draft?: { id: string; version: number } }, Error, Record<string, unknown>>({
    mutationFn: async (body) => unwrapResult(await patchBracketSettings(body)),
    onSettled: () => {
      void invalidate()
    },
  })
}
