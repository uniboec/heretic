'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQueries } from '@tanstack/react-query'
import { cn } from '@/lib/cn'
import { fetchAdminCategoryStructure } from '@/lib/brackets/admin/api'
import { bracketAdminQueryKeys } from '@/lib/brackets/admin/queryKeys'
import { isAdminCategoryExportCandidate } from '@/lib/brackets/export/exportCandidates'
import {
  exportBracketSectionsToPdf,
  exportBracketSectionsToWord,
} from '@/lib/brackets/export/clientBracketExport'
import { printAdminBracketBulkSections } from '@/lib/brackets/export/prepareAdminBracketBulkPrint'
import { waitForBracketLayout } from '@/lib/brackets/export/waitForBracketLayout'
import { buildSingleCategoryExportFilename } from '@/lib/brackets/export/filename'
import type { CategoryPanelData } from './AdminBracketCategoryPanel'
import {
  AdminBracketBulkCategorySection,
  buildAdminBracketCategoryMeta,
} from './AdminBracketBulkCategorySection'
import { usePublishedScheduleDisplayByBoutId } from '@/lib/bouts/usePublishedScheduleDisplayByBoutId'

function sortPrintCategories(categories: CategoryPanelData[]): CategoryPanelData[] {
  return [...categories].sort((a, b) => {
    const matA = a.matIndex ?? Number.MAX_SAFE_INTEGER
    const matB = b.matIndex ?? Number.MAX_SAFE_INTEGER
    if (matA !== matB) return matA - matB
    if (a.competitionStage !== b.competitionStage) return a.competitionStage - b.competitionStage
    return a.title.localeCompare(b.title, 'ru')
  })
}

export type BulkBracketRequest =
  | { kind: 'print' }
  | { kind: 'pdf'; includeTitlePage?: boolean; categoryKey?: string | null }
  | { kind: 'word'; includeTitlePage?: boolean; categoryKey?: string | null }

export type AdminBracketsBulkRendererHandle = {
  run: (request: BulkBracketRequest) => void
}

export const AdminBracketsBulkRenderer = forwardRef<
  AdminBracketsBulkRendererHandle,
  {
    categories: CategoryPanelData[]
    busy?: boolean
    onBusyChange?: (busy: boolean) => void
    onError: (message: string) => void
  }
>(function AdminBracketsBulkRenderer({ categories, busy = false, onBusyChange, onError }, ref) {
  const [enabled, setEnabled] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<BulkBracketRequest | null>(null)
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())
  const actionRunningRef = useRef(false)
  const scheduleDisplayByBoutId = usePublishedScheduleDisplayByBoutId()

  const exportableCategories = useMemo(
    () => sortPrintCategories(categories.filter(isAdminCategoryExportCandidate)),
    [categories],
  )

  const filteredCategories = useMemo(() => {
    if (!pendingRequest?.categoryKey) return exportableCategories
    return exportableCategories.filter((category) => category.categoryKey === pendingRequest.categoryKey)
  }, [exportableCategories, pendingRequest?.categoryKey])

  const structureQueries = useQueries({
    queries: exportableCategories.map((category) => ({
      queryKey: [...bracketAdminQueryKeys.structure(category.categoryKey), 'live'],
      queryFn: async () => {
        const result = await fetchAdminCategoryStructure(category.categoryKey, { live: true })
        if (!result.ok) {
          throw new Error(result.message)
        }
        return result.data
      },
      enabled: enabled && exportableCategories.length > 0,
      staleTime: 30_000,
    })),
  })

  const isLoading = structureQueries.some((query) => query.isLoading)
  const isError = structureQueries.some((query) => query.isError)
  const allSuccess =
    exportableCategories.length > 0 && structureQueries.every((query) => query.isSuccess)

  const run = useCallback(
    (request: BulkBracketRequest) => {
      if (actionRunningRef.current) return
      setEnabled(true)
      setPendingRequest(request)
      onBusyChange?.(true)
    },
    [onBusyChange],
  )

  useImperativeHandle(ref, () => ({ run }), [run])

  const collectSections = useCallback(() => {
    return filteredCategories.flatMap((category) => {
      const element = sectionRefs.current.get(category.categoryKey)
      if (!element) return []
      const index = exportableCategories.findIndex((entry) => entry.categoryKey === category.categoryKey)
      const structure = index >= 0 ? structureQueries[index]?.data : undefined
      return [
        {
          element,
          title: category.title,
          meta: buildAdminBracketCategoryMeta(category, structure),
        },
      ]
    })
  }, [exportableCategories, filteredCategories, structureQueries])

  useEffect(() => {
    if (!pendingRequest) return
    if (filteredCategories.length === 0) {
      onError('Нет сеток для экспорта')
      setPendingRequest(null)
      onBusyChange?.(false)
      return
    }
    if (!enabled || isLoading) return
    if (isError) {
      onError('Не удалось загрузить сетки')
      setPendingRequest(null)
      onBusyChange?.(false)
      return
    }
    if (!allSuccess) return
    if (actionRunningRef.current) return

    const request = pendingRequest
    actionRunningRef.current = true

    const frame = window.requestAnimationFrame(() => {
      void (async () => {
        try {
          await waitForBracketLayout()

          const sections = collectSections()
          if (sections.length === 0) {
            throw new Error('Не удалось подготовить сетки для экспорта')
          }

          if (request.kind === 'print') {
            await printAdminBracketBulkSections(sections.map((section) => section.element))
            return
          }

          const singleTitle = sections.length === 1 ? sections[0]!.title : null
          if (request.kind === 'pdf') {
            await exportBracketSectionsToPdf(sections, {
              includeTitlePage: request.includeTitlePage,
              filename:
                singleTitle && request.categoryKey
                  ? buildSingleCategoryExportFilename(singleTitle, 'pdf')
                  : undefined,
            })
            return
          }

          await exportBracketSectionsToWord(sections, {
            includeTitlePage: request.includeTitlePage,
            categoryKey: request.categoryKey,
            filename:
              singleTitle && request.categoryKey
                ? buildSingleCategoryExportFilename(singleTitle)
                : undefined,
          })
        } catch (error) {
          onError(error instanceof Error ? error.message : 'Не удалось выполнить экспорт')
        } finally {
          actionRunningRef.current = false
          setPendingRequest(null)
          onBusyChange?.(false)
        }
      })()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [
    allSuccess,
    collectSections,
    enabled,
    filteredCategories.length,
    isError,
    isLoading,
    onBusyChange,
    onError,
    pendingRequest,
  ])

  if (!enabled || exportableCategories.length === 0) return null

  const categoriesToRender = pendingRequest ? filteredCategories : exportableCategories

  return (
    <div
      className={cn(
        'admin-brackets-bulk-export admin-brackets-print-all event-brackets-page pointer-events-none fixed top-0 left-0 z-[-1] w-max max-w-none -translate-x-[200vw] bg-card',
        'print:static print:z-auto print:block print:w-auto print:max-w-none print:translate-x-0',
      )}
      aria-hidden={!busy}
    >
      {categoriesToRender.map((category) => {
        const index = exportableCategories.findIndex(
          (entry) => entry.categoryKey === category.categoryKey,
        )
        const query = index >= 0 ? structureQueries[index] : undefined

        return (
          <div key={category.categoryKey} className="admin-brackets-print-all__page">
            <AdminBracketBulkCategorySection
              category={category}
              structure={query?.data}
              loading={Boolean(query?.isLoading)}
              error={Boolean(query?.isError)}
              scheduleDisplayByBoutId={scheduleDisplayByBoutId}
              sectionRef={(node) => {
                if (node) sectionRefs.current.set(category.categoryKey, node)
                else sectionRefs.current.delete(category.categoryKey)
              }}
            />
          </div>
        )
      })}
    </div>
  )
})
