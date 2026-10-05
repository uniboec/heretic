'use client'

import { adminPageActionsBtn, adminPanel, adminPanelHeader, adminCards, adminTableDesktop, adminTableWrap, adminRowCard, adminCardFields, adminCardField, adminSegmentTab, adminBracketsTabs, adminBracketsToolbar, adminBracketsToolbarGroup, adminBracketsToolbarLabel } from '@/lib/ui/adminSurfaceStyles'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Printer, FileDown } from 'lucide-react'
import { withBasePath } from '@/lib/basePath'
import { cn } from '@/lib/cn'
import { routes } from '@/lib/routes'
import { Button } from '@/components/ui/Button'
import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminBracketFormatRulesTab } from '@/components/admin/AdminBracketFormatRulesTab'
import {
  useAdminBracketsDashboard,
  usePatchBracketSettingsMutation,
  useRedrawBracketsMutation,
  useSyncBracketsMutation,
  useVisibilityMutation,
  useBoutsReleaseMutation,
  type NormalizedDashboard,
} from '@/lib/brackets/admin/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { applyDraftMutationToDashboard } from '@/lib/brackets/admin/cacheUpdate'
import { overlayAllCategoryKeysWithLiveCategories } from '@/lib/brackets/admin/moveTargetOptions'
import { bracketAdminQueryKeys } from '@/lib/brackets/admin/queryKeys'
import {
  createBackup,
  applyConsolidationBrackets,
  fetchImpactPreview,
  forceRebuildBrackets,
  listBackups,
  patchBracketSettings,
  previewConsolidationBrackets,
  resetBrackets,
  restoreBackup,
} from '@/lib/brackets/admin/api'
import type { BracketBackupSummary, ImpactPreviewOperation } from '@/lib/brackets/admin/types'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import {
  isCategoryReadyForPublication,
  isCategoryReadyForScheduleRelease,
} from '@/lib/brackets/admin/publicationTargets'
import { AdminBracketAlertBanners } from './AdminBracketAlertBanners'
import { AdminBracketCategoryPanel } from './AdminBracketCategoryPanel'
import { AdminBracketCategorySidebar } from './AdminBracketCategorySidebar'
import { AdminBracketDraftToolbar } from './AdminBracketDraftToolbar'
import { AdminBracketMoveHistory } from './AdminBracketMoveHistory'
import { AdminBracketMedalEstimate } from './AdminBracketMedalEstimate'
import { AdminBracketSettingsPanel } from './AdminBracketSettingsPanel'
import { AdminBracketImpactConfirmDialog } from './AdminBracketImpactConfirmDialog'
import { AdminBracketBackupDialog } from './AdminBracketBackupDialog'
import { AdminBracketRedrawAllConfirmDialog } from './AdminBracketRedrawAllConfirmDialog'
import { AdminBracketStatsRow } from './AdminBracketStatsRow'
import { AdminBracketSyncConfirmDialog } from './AdminBracketSyncConfirmDialog'
import { AdminBracketRedrawConfirmDialog } from './AdminBracketRedrawConfirmDialog'
import {
  AdminBracketOperationOverlay,
  type BracketOperationKind,
} from './AdminBracketOperationOverlay'
import { AdminBracketConsolidationDialog } from './AdminBracketConsolidationDialog'
import type { ConsolidationPolicy } from '@/lib/brackets/consolidation/types'
import { AdminBracketWorkflowStatusBar } from './AdminBracketWorkflowStatusBar'
import {
  AdminBracketsBulkRenderer,
  type AdminBracketsBulkRendererHandle,
} from './AdminBracketsBulkRenderer'
import { AdminBracketsQueryProvider } from './AdminBracketsQueryProvider'
import { collectConfiguredCategoryStages } from '@/lib/bouts/competitionStages'
import {
  EMPTY_COMPETITION_STAGE_SETTINGS,
  type CompetitionStageSettings,
} from '@/lib/bouts/competitionStageSettings'
import { filterCategoriesByQuery } from './bracketAdminUtils'
import { isAdminCategoryExportCandidate } from '@/lib/brackets/export/exportCandidates'
import { formatBracketWarnings } from './bracketWarningLabels'
import {
  BRACKET_ACTION_LABELS,
  BRACKET_BACKUP_LABELS,
  BRACKET_IMPACT_CONFIRM,
  BRACKET_EXPORT_LABELS,
  formatBracketConflictMessage,
} from '@/lib/brackets/labels'

type Tab = 'brackets' | 'format-rules' | 'settings'

type ImpactConfirmState = {
  operation: ImpactPreviewOperation | 'consolidation_apply'
  title: string
  body: string
  impactToken: string
  affectedCount: number
  totalCount: number
  affectedCategoryKeys: string[]
  lockLevels: Record<string, import('@/lib/brackets/live/guard').CategoryLockLevel>
  backupId?: string
  categoryKeys?: string[]
  includePaid?: boolean
  includeUnpaid?: boolean
  consolidationApply?: {
    policy: ConsolidationPolicy
    consolidationPlanToken: string
  }
}

function AdminBracketsDashboardInner() {
  const queryClient = useQueryClient()
  const dashboardQuery = useAdminBracketsDashboard()
  const syncMutation = useSyncBracketsMutation()
  const redrawMutation = useRedrawBracketsMutation()
  const visibilityMutation = useVisibilityMutation()
  const boutsReleaseMutation = useBoutsReleaseMutation()
  const settingsMutation = usePatchBracketSettingsMutation()

  const [tab, setTab] = useState<Tab>('brackets')
  const initialCategorySelected = useRef(false)
  const [draft, setDraft] = useState<{ id: string; version: number } | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [syncConfirm, setSyncConfirm] = useState<'all' | 'category' | null>(null)
  const [redrawStaleConfirm, setRedrawStaleConfirm] = useState(false)
  const [redrawAllConfirm, setRedrawAllConfirm] = useState(false)
  const [impactConfirm, setImpactConfirm] = useState<ImpactConfirmState | null>(null)
  const [impactLoading, setImpactLoading] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [consolidationOpen, setConsolidationOpen] = useState(false)
  const [backups, setBackups] = useState<BracketBackupSummary[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [operation, setOperation] = useState<BracketOperationKind>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const bulkRendererRef = useRef<AdminBracketsBulkRendererHandle>(null)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [categoryQuery, setCategoryQuery] = useState('')
  const [matCount, setMatCount] = useState(1)
  const [autoMatAssignMode, setAutoMatAssignMode] = useState<
    import('@/lib/bouts/autoMatMode').AutoMatAssignMode
  >('BY_CATEGORY')
  const [autoMatByCategoryEnabled, setAutoMatByCategoryEnabled] = useState(false)
  const [competitionStageSettings, setCompetitionStageSettings] =
    useState<CompetitionStageSettings>(EMPTY_COMPETITION_STAGE_SETTINGS)
  const [scheduleVersion, setScheduleVersion] = useState(0)

  useEffect(() => {
    fetch(withBasePath('/api/admin/bouts/settings'))
      .then((response) =>
        readJsonResponse<{
          settings?: {
            matCount?: number
            autoMatAssignMode?: import('@/lib/bouts/autoMatMode').AutoMatAssignMode
            autoMatByCategoryEnabled?: boolean
            competitionStageSettings?: CompetitionStageSettings
            scheduleVersion?: number
          }
        }>(response),
      )
      .then((result) => {
        if (!result.ok) return
        const json = result.data
        if (json.settings?.matCount) setMatCount(json.settings.matCount)
        if (json.settings?.autoMatAssignMode) setAutoMatAssignMode(json.settings.autoMatAssignMode)
        setAutoMatByCategoryEnabled(Boolean(json.settings?.autoMatByCategoryEnabled))
        setCompetitionStageSettings(
          json.settings?.competitionStageSettings ?? EMPTY_COMPETITION_STAGE_SETTINGS,
        )
        if (typeof json.settings?.scheduleVersion === 'number') {
          setScheduleVersion(json.settings.scheduleVersion)
        }
      })
      .catch(() => undefined)
  }, [])
  const [settingsDraft, setSettingsDraft] = useState({
    publicEnabled: false,
    includePaid: true,
    includeUnpaid: false,
  })

  const data: NormalizedDashboard | undefined = dashboardQuery.data
  const loading = dashboardQuery.isLoading
  const loadError = dashboardQuery.error instanceof Error ? dashboardQuery.error.message : null

  const showToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 5000)
  }, [])

  useEffect(() => {
    if (!data) return
    setSettingsDraft({
      publicEnabled: data.settings.publicEnabled,
      includePaid: data.settings.includePaid,
      includeUnpaid: data.settings.includeUnpaid,
    })
    if (data.draft) setDraft(data.draft)
    if (!initialCategorySelected.current && data.categories.length > 0) {
      setSelectedKey(data.categories[0]?.categoryKey ?? null)
      initialCategorySelected.current = true
    }
  }, [data])

  const categories = data?.categories ?? []

  const exportableActiveCount = useMemo(
    () => categories.filter(isAdminCategoryExportCandidate).length,
    [categories],
  )

  const liveAllCategoryKeys = useMemo(
    () => overlayAllCategoryKeysWithLiveCategories(data?.allCategoryKeys ?? [], categories),
    [categories, data?.allCategoryKeys],
  )

  const filteredCategories = useMemo(
    () => filterCategoriesByQuery(categories, categoryQuery),
    [categories, categoryQuery],
  )

  const configuredCategoryStages = useMemo(() => {
    if (data?.configuredCategoryStages?.length) {
      return data.configuredCategoryStages
    }
    return collectConfiguredCategoryStages(
      categories.map((category) => ({
        competitionStage: category.competitionStage ?? 1,
      })),
    )
  }, [categories, data?.configuredCategoryStages])

  useEffect(() => {
    if (!data) return
    if (selectedKey && categories.some((category) => category.categoryKey === selectedKey)) {
      return
    }
    setSelectedKey(categories[0]?.categoryKey ?? null)
  }, [data, categories, selectedKey])

  const busy =
    syncMutation.isPending ||
    redrawMutation.isPending ||
    visibilityMutation.isPending ||
    boutsReleaseMutation.isPending ||
    settingsMutation.isPending ||
    impactLoading

  const staleCompositionCount = categories.filter((category) => category.compositionStale).length
  const staleRedrawCount = categories.filter(
    (category) => category.seedingStale || category.balanceStale,
  ).length
  const toPublishabilityInput = (category: (typeof categories)[number]) => ({
    status: category.status,
    autoSystemId: category.autoSystemId,
    systemOverride: category.systemOverride,
    participantCount: category.participants.length,
    compositionStale: category.compositionStale,
    seedingStale: category.seedingStale,
    balanceStale: category.balanceStale,
  })
  const siteReadyCount = categories.filter((category) =>
    isCategoryReadyForPublication(
      toPublishabilityInput(category),
      data?.diff.globalCompositionStale ?? false,
    ),
  ).length
  const publicVisibleCount = categories.filter((category) => category.publicVisible).length
  const boutsReleasedCount = categories.filter((category) => category.boutsReleased).length
  const independentBoutsRelease = data?.features?.independentBoutsRelease ?? false
  const publishableCount = categories.filter((category) =>
    isCategoryReadyForScheduleRelease(
      toPublishabilityInput(category),
      data?.diff.globalCompositionStale ?? false,
    ),
  ).length
  const registeredParticipantCount = liveAllCategoryKeys.reduce(
    (sum, item) => sum + item.participantCount,
    0,
  )

  const runGenerate = async (
    mode: 'SYNC' | 'REDRAW',
    scope: 'all' | 'category',
    options?: { onlyStale?: boolean },
  ) => {
    if (!draft) return
    if (scope === 'category' && !selectedKey) return

    const operationKind: BracketOperationKind =
      mode === 'SYNC'
        ? scope === 'all'
          ? 'syncAll'
          : 'syncCategory'
        : scope === 'all'
          ? options?.onlyStale
            ? 'redrawAll'
            : 'redrawAllForce'
          : 'redrawCategory'

    const mutate = mode === 'SYNC' ? syncMutation : redrawMutation
    setOperation(operationKind)
    try {
      const result = await mutate.mutateAsync({
        draftId: draft.id,
        expectedVersion: draft.version,
        scope,
        categoryKey: scope === 'category' ? selectedKey ?? undefined : undefined,
        ...(mode === 'REDRAW' && scope === 'all'
          ? { onlyStale: options?.onlyStale ?? false }
          : {}),
      })
      setDraft(result.draft)
      const categoryTitleMap = new Map(
        (data?.allCategoryKeys ?? []).map((item) => [item.key, item.title]),
      )
      setWarnings(formatBracketWarnings(result.warnings ?? [], categoryTitleMap))
      showToast(
        mode === 'SYNC'
          ? scope === 'all'
            ? 'Заявки синхронизированы'
            : 'Категория синхронизирована'
          : scope === 'all'
            ? options?.onlyStale
              ? 'Жеребьёвка устаревших категорий выполнена'
              : 'Жеребьёвка всех категорий выполнена'
            : 'Жеребьёвка категории выполнена',
        'success',
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Ошибка операции', 'error')
    } finally {
      setOperation(null)
    }
  }

  const runVisibility = async (
    scope: 'all' | 'category',
    visible: boolean,
    categoryKey?: string,
  ) => {
    if (!data?.controlsEnabled) return
    if (scope === 'category' && !categoryKey) return

    try {
      await visibilityMutation.mutateAsync({
        scope,
        categoryKey,
        visible,
      })
      showToast(
        visible
          ? scope === 'all'
            ? 'Все категории показаны на сайте'
            : 'Категория показана на сайте'
          : scope === 'all'
            ? 'Все категории скрыты с сайта'
            : 'Категория скрыта с сайта',
        'success',
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Ошибка операции', 'error')
    }
  }

  const runBoutsRelease = async (
    scope: 'category' | 'ready' | 'all',
    released: boolean,
    categoryKey?: string,
  ) => {
    if (!data?.controlsEnabled) return
    const expectedPublishedGenerationId = data.published?.id ?? data.draft?.id
    if (!expectedPublishedGenerationId) return
    const category = categoryKey
      ? categories.find((item) => item.categoryKey === categoryKey)
      : null

    try {
      const result = await boutsReleaseMutation.mutateAsync({
        scope,
        released,
        categoryKey,
        expectedPublishedGenerationId,
        expectedScheduleVersion: scheduleVersion,
        ...(scope === 'category' && category
          ? {
              expectedPublishedDrawId:
                category.publicationState?.publishedDrawId ?? category.id,
            }
          : {}),
      })
      if (typeof result.scheduleVersion === 'number') {
        setScheduleVersion(result.scheduleVersion)
      }
      showToast(
        released
          ? scope === 'category'
            ? 'Категория добавлена в расписание'
            : 'Готовые категории добавлены в расписание'
          : scope === 'category'
            ? 'Категория убрана из расписания'
            : 'Все категории убраны из расписания',
        'success',
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Ошибка операции', 'error')
    }
  }

  const loadImpactPreview = async (input: {
    operation: ImpactPreviewOperation
    backupId?: string
    categoryKeys?: string[]
    includePaid?: boolean
    includeUnpaid?: boolean
  }): Promise<ImpactConfirmState | null> => {
    if (!draft) return null
    setImpactLoading(true)
    try {
      const result = await fetchImpactPreview({
        operation: input.operation,
        expectedVersion: draft.version,
        ...(input.backupId ? { backupId: input.backupId } : {}),
        ...(input.categoryKeys ? { categoryKeys: input.categoryKeys } : {}),
        ...(input.includePaid !== undefined ? { includePaid: input.includePaid } : {}),
        ...(input.includeUnpaid !== undefined ? { includeUnpaid: input.includeUnpaid } : {}),
      })
      if (!result.ok) {
        showToast(result.message, 'error')
        return null
      }
      const preview = result.data
      const title =
        input.operation === 'reset'
          ? BRACKET_IMPACT_CONFIRM.resetTitle
          : input.operation === 'settings_eligibility'
            ? BRACKET_IMPACT_CONFIRM.settingsTitle
            : input.operation === 'standalone_force_rebuild'
              ? BRACKET_IMPACT_CONFIRM.forceRebuildTitle
              : BRACKET_IMPACT_CONFIRM.restoreTitle
      const body =
        input.operation === 'reset'
          ? BRACKET_IMPACT_CONFIRM.resetBody
          : input.operation === 'settings_eligibility'
            ? BRACKET_IMPACT_CONFIRM.settingsBody
            : input.operation === 'standalone_force_rebuild'
              ? BRACKET_IMPACT_CONFIRM.forceRebuildBody
              : BRACKET_IMPACT_CONFIRM.restoreBody
      return {
        operation: input.operation,
        title,
        body,
        impactToken: preview.impactToken,
        affectedCount: preview.affectedCategoryKeys.length,
        totalCount: preview.totalCategoryCount,
        affectedCategoryKeys: preview.affectedCategoryKeys,
        lockLevels: preview.lockLevels,
        backupId: input.backupId,
        categoryKeys: input.categoryKeys,
        includePaid: input.includePaid,
        includeUnpaid: input.includeUnpaid,
      }
    } finally {
      setImpactLoading(false)
    }
  }

  const openResetConfirm = async () => {
    const next = await loadImpactPreview({ operation: 'reset' })
    if (next) setImpactConfirm(next)
  }

  const openBackupDialog = async () => {
    setBackupOpen(true)
    setBackupsLoading(true)
    try {
      const result = await listBackups()
      if (!result.ok) {
        showToast(result.message, 'error')
        setBackups([])
        return
      }
      setBackups(result.data.backups)
    } finally {
      setBackupsLoading(false)
    }
  }

  const handleCreateBackup = async () => {
    setOperation('backup')
    try {
      const result = await createBackup()
      if (!result.ok) {
        showToast(result.message, 'error')
        return
      }
      showToast(BRACKET_BACKUP_LABELS.created, 'success')
      const listResult = await listBackups()
      if (listResult.ok) setBackups(listResult.data.backups)
    } finally {
      setOperation(null)
    }
  }

  const handleRestoreBackup = async (backupId: string) => {
    const next = await loadImpactPreview({ operation: 'restore_backup', backupId })
    if (next) {
      setBackupOpen(false)
      setImpactConfirm(next)
    }
  }

  const commitImpactOperation = async (state: ImpactConfirmState) => {
    if (!draft) return
    const operationKind =
      state.operation === 'reset'
        ? 'reset'
        : state.operation === 'settings_eligibility'
          ? 'settings'
          : state.operation === 'standalone_force_rebuild'
            ? 'forceRebuild'
            : 'restoreBackup'
    setOperation(operationKind)
    try {
      let result:
        | Awaited<ReturnType<typeof resetBrackets>>
        | Awaited<ReturnType<typeof restoreBackup>>
        | Awaited<ReturnType<typeof patchBracketSettings>>
        | Awaited<ReturnType<typeof forceRebuildBrackets>>
        | null = null

      if (state.operation === 'reset') {
        result = await resetBrackets({
          expectedVersion: draft.version,
          impactToken: state.impactToken,
        })
      } else if (state.operation === 'restore_backup' && state.backupId) {
        result = await restoreBackup({
          backupId: state.backupId,
          expectedVersion: draft.version,
          impactToken: state.impactToken,
        })
      } else if (state.operation === 'settings_eligibility') {
        result = await patchBracketSettings({
          includePaid: state.includePaid,
          includeUnpaid: state.includeUnpaid,
          expectedVersion: draft.version,
          impactToken: state.impactToken,
        })
      } else if (state.operation === 'standalone_force_rebuild' && state.categoryKeys?.length) {
        result = await forceRebuildBrackets({
          categoryKeys: state.categoryKeys,
          expectedVersion: draft.version,
          impactToken: state.impactToken,
        })
      } else if (state.operation === 'consolidation_apply' && state.consolidationApply) {
        setOperation('consolidation')
        try {
          const consolidationResult = await applyConsolidationBrackets({
            expectedVersion: draft.version,
            policy: state.consolidationApply.policy,
            consolidationPlanToken: state.consolidationApply.consolidationPlanToken,
            impactToken: state.impactToken,
          })
          if (!consolidationResult.ok) {
            if (consolidationResult.code === 'IMPACT_CHANGED') {
              showToast(formatBracketConflictMessage('IMPACT_CHANGED'), 'error')
              setImpactConfirm(null)
              return
            }
            if (consolidationResult.status === 409) {
              showToast(formatBracketConflictMessage(consolidationResult.code), 'error')
            } else {
              showToast(consolidationResult.message, 'error')
            }
            return
          }
          setDraft(consolidationResult.data.draft)
          queryClient.setQueryData(
            bracketAdminQueryKeys.dashboard(),
            (current: NormalizedDashboard | undefined) =>
              current
                ? applyDraftMutationToDashboard(current, consolidationResult.data)
                : current,
          )
          setConsolidationOpen(false)
          showToast(
            `Автообъединение применено: ${consolidationResult.data.movedCount} переносов`,
            'success',
          )
          setImpactConfirm(null)
          await dashboardQuery.refetch()
        } finally {
          setOperation(null)
        }
        return
      }

      if (!result) {
        showToast('Ошибка операции', 'error')
        return
      }

      if (!result.ok) {
        if (result.code === 'IMPACT_CHANGED') {
          showToast(formatBracketConflictMessage('IMPACT_CHANGED'), 'error')
          if (state.operation === 'consolidation_apply') {
            setImpactConfirm(null)
            return
          }
          const refreshed = await loadImpactPreview({
            operation: state.operation,
            backupId: state.backupId,
            categoryKeys: state.categoryKeys,
            includePaid: state.includePaid,
            includeUnpaid: state.includeUnpaid,
          })
          if (refreshed) setImpactConfirm(refreshed)
          else setImpactConfirm(null)
          return
        }
        showToast(result.message, 'error')
        return
      }

      if ('generation' in result.data) {
        setDraft({
          id: result.data.generation.id,
          version: result.data.generation.version,
        })
      } else if ('draft' in result.data && result.data.draft) {
        setDraft(result.data.draft)
      }

      setImpactConfirm(null)
      const successMessage =
        state.operation === 'reset'
          ? 'Сетки сброшены'
          : state.operation === 'settings_eligibility'
            ? 'Критерии состава сохранены'
            : state.operation === 'standalone_force_rebuild'
              ? 'Категории пересобраны'
              : BRACKET_BACKUP_LABELS.restored
      showToast(successMessage, 'success')
      await dashboardQuery.refetch()
    } finally {
      setOperation(null)
    }
  }

  const saveEligibilitySettings = async () => {
    if (!draft) return
    const next = await loadImpactPreview({
      operation: 'settings_eligibility',
      includePaid: settingsDraft.includePaid,
      includeUnpaid: settingsDraft.includeUnpaid,
    })
    if (next) setImpactConfirm(next)
  }

  const openForceRebuildConfirm = async (categoryKeys: string[]) => {
    const next = await loadImpactPreview({
      operation: 'standalone_force_rebuild',
      categoryKeys,
    })
    if (next) setImpactConfirm(next)
  }

  const savePublicSetting = async () => {
    try {
      await settingsMutation.mutateAsync({ publicEnabled: settingsDraft.publicEnabled })
      showToast('Настройка публичности сохранена', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Ошибка операции', 'error')
    }
  }

  const runConsolidationPreview = async (policy: ConsolidationPolicy) => {
    if (!draft) throw new Error('Черновик не загружен')
    const result = await previewConsolidationBrackets({
      expectedVersion: draft.version,
      policy,
    })
    if (!result.ok) {
      throw new Error(result.message)
    }
    return {
      plan: result.data.plan,
      policy: result.data.policy,
      entries: result.data.entries ?? [],
      consolidationPlanToken: result.data.consolidationPlanToken,
      impactToken: result.data.impactToken,
      impact: result.data.impact,
    }
  }

  const runConsolidationApply = async (input: {
    policy: ConsolidationPolicy
    consolidationPlanToken: string
    impactToken?: string
  }) => {
    if (!draft) throw new Error('Черновик не загружен')
    setOperation('consolidation')
    try {
      const result = await applyConsolidationBrackets({
        expectedVersion: draft.version,
        policy: input.policy,
        consolidationPlanToken: input.consolidationPlanToken,
        impactToken: input.impactToken,
      })
      if (!result.ok) {
        throw new Error(
          result.status === 409
            ? formatBracketConflictMessage(result.code)
            : result.message,
        )
      }
      setDraft(result.data.draft)
      queryClient.setQueryData(
        bracketAdminQueryKeys.dashboard(),
        (current: NormalizedDashboard | undefined) =>
          current ? applyDraftMutationToDashboard(current, result.data) : current,
      )
      showToast(`Автообъединение применено: ${result.data.movedCount} переносов`, 'success')
      await dashboardQuery.refetch()
    } finally {
      setOperation(null)
    }
  }

  const requestConsolidationApply = (input: {
    policy: ConsolidationPolicy
    consolidationPlanToken: string
    impactToken?: string
    impact?: {
      affectedCategoryKeys: string[]
      lockLevels: Record<string, import('@/lib/brackets/live/guard').CategoryLockLevel>
      totalCategoryCount: number
    }
  }) => {
    if (input.impactToken && input.impact && input.impact.affectedCategoryKeys.length > 0) {
      setImpactConfirm({
        operation: 'consolidation_apply',
        title: BRACKET_IMPACT_CONFIRM.consolidationTitle,
        body: BRACKET_IMPACT_CONFIRM.consolidationBody,
        impactToken: input.impactToken,
        affectedCount: input.impact.affectedCategoryKeys.length,
        totalCount: input.impact.totalCategoryCount,
        affectedCategoryKeys: input.impact.affectedCategoryKeys,
        lockLevels: input.impact.lockLevels,
        consolidationApply: {
          policy: input.policy,
          consolidationPlanToken: input.consolidationPlanToken,
        },
      })
      return
    }

    void runConsolidationApply(input)
      .then(() => setConsolidationOpen(false))
      .catch((error) => {
        showToast(error instanceof Error ? error.message : 'Ошибка операции', 'error')
      })
  }

  if (!data) {
    if (loading) {
      return <p className="text-sm text-muted">Загрузка сеток…</p>
    }

    return (
      <div className="space-y-4">
        <AdminPageHeader
          title="Сетки"
          description="Черновик, жеребьёвка и публикация турнирных сеток"
        />
        <div className={`${adminPanel} space-y-3 p-4`}>
          <p className="text-sm text-danger-foreground">
            {loadError ?? 'Не удалось загрузить данные сеток.'}
          </p>
          <Button onClick={() => void dashboardQuery.refetch()} disabled={loading}>
            Повторить
          </Button>
        </div>
      </div>
    )
  }

  const diff = data.diff
  const selected = categories.find((category) => category.categoryKey === selectedKey) ?? null

  const headerActions =
    tab === 'brackets' || settingsDraft.publicEnabled ? (
      <div className="flex flex-wrap items-center gap-2">
        {tab === 'brackets' && (
          <>
            <Button
              type="button"
              variant="ghost"
              className={cn(adminPageActionsBtn, 'inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium')}
              onClick={() =>
                bulkRendererRef.current?.run({ kind: 'pdf', includeTitlePage: true })
              }
              disabled={exportableActiveCount === 0 || exportBusy}
              aria-label={BRACKET_EXPORT_LABELS.downloadAllPdf}
            >
              <FileDown className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span>{exportBusy ? BRACKET_EXPORT_LABELS.generating : BRACKET_EXPORT_LABELS.downloadAllPdf}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn(adminPageActionsBtn, 'inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium')}
              onClick={() =>
                bulkRendererRef.current?.run({ kind: 'word', includeTitlePage: true })
              }
              disabled={exportableActiveCount === 0 || exportBusy}
              aria-label={BRACKET_EXPORT_LABELS.downloadAllWord}
            >
              <FileDown className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span>{exportBusy ? BRACKET_EXPORT_LABELS.generating : BRACKET_EXPORT_LABELS.downloadAllWord}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                cn(adminPageActionsBtn, 'event-brackets-print-btn'),
                tournamentPublicUi.printBtn,
                tournamentPublicUi.printBtnIconOnly,
              )}
              onClick={() => bulkRendererRef.current?.run({ kind: 'print' })}
              disabled={exportableActiveCount === 0 || exportBusy}
              aria-label="Печать всех сеток"
            >
              <Printer className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className={cn('event-brackets-print-btn-label', tournamentPublicUi.printBtnLabel)}>
                {exportBusy ? 'Подготовка…' : 'Печать'}
              </span>
            </Button>
          </>
        )}
        {settingsDraft.publicEnabled ? (
          <a
            href={withBasePath(routes.brackets)}
            target="_blank"
            rel="noreferrer"
            className={cn(adminPageActionsBtn, 'inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted/40')}
          >
            Открыть публичную страницу
          </a>
        ) : null}
      </div>
    ) : undefined

  return (
    <div className="event-brackets-page space-y-6">
      <div className="print:hidden">
        <AdminPageHeader
          title="Сетки"
          description="Черновик, жеребьёвка и публикация турнирных сеток"
          actions={headerActions}
        />
      </div>

      <div className="print:hidden">
        <AdminBracketStatsRow
        categoryCount={categories.length}
        activeCount={siteReadyCount}
        publicVisibleCount={publicVisibleCount}
        staleCompositionCount={staleCompositionCount}
        staleRedrawCount={staleRedrawCount}
        />
      </div>

      {tab === 'brackets' && (
        <div className="print:hidden">
          <AdminBracketMedalEstimate categories={categories} />
        </div>
      )}

      {toast && (
        <div
          className={cn(
            'fixed bottom-4 right-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg print:hidden',
            toast.type === 'error' ? 'bg-danger text-white' : 'bg-success text-white',
          )}
        >
          {toast.message}
        </div>
      )}

      <div className={`${adminBracketsTabs} print:hidden`} role="tablist" aria-label="Разделы сеток">
        {(['brackets', 'format-rules', 'settings'] as Tab[]).map((t) => (
          <Button
            key={t}
            type="button"
            variant="ghost"
            role="tab"
            aria-selected={tab === t}
            className={adminSegmentTab(tab === t)}
            onClick={() => setTab(t)}
          >
            {t === 'brackets' ? 'Сетки' : t === 'format-rules' ? 'Правила формата' : 'Настройки'}
          </Button>
        ))}
      </div>

      {tab === 'brackets' && (
        <div className="print:hidden">
          <AdminBracketAlertBanners
            diff={diff}
            categories={categories}
            registeredParticipantCount={registeredParticipantCount}
            categoryCount={categories.length}
            warnings={warnings}
            autoSyncFailures={data.autoSyncFailures}
          />
        </div>
      )}

      {tab === 'format-rules' && (
        <AdminBracketFormatRulesTab
          draftId={draft?.id ?? null}
          draftVersion={draft?.version ?? null}
          onSaved={() => void dashboardQuery.refetch()}
          onDraftChange={setDraft}
          onWarnings={setWarnings}
          onToast={showToast}
        />
      )}

      {tab === 'settings' && (
        <AdminBracketSettingsPanel
          settingsDraft={settingsDraft}
          busy={busy}
          hasDraft={Boolean(draft)}
          onSettingsChange={(updater) => setSettingsDraft((current) => updater(current))}
          onSavePublicSetting={() => void savePublicSetting()}
          onSaveEligibilitySettings={() => void saveEligibilitySettings()}
        />
      )}

      <AdminBracketsBulkRenderer
        ref={bulkRendererRef}
        categories={categories}
        busy={exportBusy}
        onBusyChange={setExportBusy}
        onError={(message) => showToast(message, 'error')}
      />

      {tab === 'brackets' && (
        <div className="space-y-4 print:hidden">
          <div className={cn(adminPanel, 'p-4 print:hidden')}>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold">Управление черновиком</p>
                <p className="mt-1 text-sm text-muted">
                  Рабочая версия {draft?.version ?? '—'}
                </p>
              </div>

              <AdminBracketWorkflowStatusBar
                globalCompositionStale={diff.globalCompositionStale}
                registrationDataStale={diff.registrationDataStale}
                eligibilityCriteriaStale={diff.eligibilityCriteriaStale}
                staleRedrawCount={staleRedrawCount}
                controlsEnabled={data.controlsEnabled}
                publicVisibleCount={publicVisibleCount}
                boutsReleasedCount={boutsReleasedCount}
                independentBoutsRelease={independentBoutsRelease}
                categoryCount={categories.length}
              />

              <AdminBracketDraftToolbar
                busy={busy}
                globalCompositionStale={diff.globalCompositionStale}
                controlsEnabled={data.controlsEnabled}
                activeCount={siteReadyCount}
                publishableCount={publishableCount}
                publicVisibleCount={publicVisibleCount}
                boutsReleasedCount={boutsReleasedCount}
                independentBoutsRelease={independentBoutsRelease}
                staleRedrawCount={staleRedrawCount}
                categoryCount={categories.length}
                redrawStaleLabel={
                  staleRedrawCount > 0
                    ? BRACKET_ACTION_LABELS.redrawAllStale(staleRedrawCount)
                    : BRACKET_ACTION_LABELS.redrawAll
                }
                onSyncAll={() => setSyncConfirm('all')}
                onSyncCategory={() => setSyncConfirm('category')}
                onRedrawStale={() => setRedrawStaleConfirm(true)}
                onRedrawAll={() => setRedrawAllConfirm(true)}
                onReset={() => void openResetConfirm()}
                onBackup={() => void openBackupDialog()}
                onConsolidation={() => setConsolidationOpen(true)}
                onShowAllReady={() => void runVisibility('all', true)}
                onHideAll={() => void runVisibility('all', false)}
                onReleaseAllReady={() => void runBoutsRelease('ready', true)}
                onUnreleaseAll={() => void runBoutsRelease('all', false)}
              />
            </div>
          </div>

          <div className={tournamentPublicUi.bracketsGrid}>
            <AdminBracketCategorySidebar
              categories={categories}
              filteredCategories={filteredCategories}
              selectedKey={selectedKey}
              categoryQuery={categoryQuery}
              matCount={matCount}
              onCategoryQueryChange={setCategoryQuery}
              onSelectCategory={setSelectedKey}
            />

            <section className={`${adminPanel} min-w-0`}>
              {!selected || !draft ? (
                <div className="flex min-h-[24rem] items-center justify-center p-6 text-sm text-muted print:hidden">
                  Выберите категорию слева
                </div>
              ) : (
                <div className="p-4">
                  <AdminBracketCategoryPanel
                    category={selected}
                    draftId={draft.id}
                    draftVersion={draft.version}
                    allCategoryKeys={liveAllCategoryKeys}
                    onDraftChange={setDraft}
                    onToast={showToast}
                    globalCompositionStale={diff.globalCompositionStale}
                    controlsEnabled={data.controlsEnabled}
                    independentBoutsRelease={independentBoutsRelease}
                    matCount={matCount}
                    autoMatAssignMode={autoMatAssignMode}
                    autoMatByCategoryEnabled={autoMatByCategoryEnabled}
                    configuredCategoryStages={configuredCategoryStages}
                    competitionStageSettings={competitionStageSettings}
                    scheduleVersion={scheduleVersion}
                    onScheduleVersionChange={setScheduleVersion}
                    onDashboardRefresh={() => void dashboardQuery.refetch()}
                    onCategoryVisibilityChange={(visible) =>
                      runVisibility('category', visible, selected.categoryKey)
                    }
                    onCategoryBoutsReleaseChange={(released) =>
                      runBoutsRelease('category', released, selected.categoryKey)
                    }
                    onForceRebuild={(categoryKeys) => void openForceRebuildConfirm(categoryKeys)}
                  />
                </div>
              )}
            </section>
          </div>

          <div className="print:hidden">
            <AdminBracketMoveHistory
              draftId={draft?.id ?? null}
              draftVersion={draft?.version ?? null}
              busy={busy}
              onDraftChange={setDraft}
              onUpdated={() => void dashboardQuery.refetch()}
              onToast={showToast}
            />
          </div>
        </div>
      )}

      <AdminBracketSyncConfirmDialog
        open={syncConfirm !== null}
        scope={syncConfirm ?? 'all'}
        busy={busy}
        canConfirmCategory={Boolean(selectedKey)}
        onCancel={() => setSyncConfirm(null)}
        onConfirm={() => {
          const scope = syncConfirm
          setSyncConfirm(null)
          if (scope) void runGenerate('SYNC', scope)
        }}
      />

      <AdminBracketRedrawConfirmDialog
        open={redrawStaleConfirm}
        staleCount={staleRedrawCount}
        busy={busy}
        onCancel={() => setRedrawStaleConfirm(false)}
        onConfirm={() => {
          setRedrawStaleConfirm(false)
          void runGenerate('REDRAW', 'all', { onlyStale: true })
        }}
      />

      <AdminBracketRedrawAllConfirmDialog
        open={redrawAllConfirm}
        categoryCount={categories.length}
        busy={busy}
        onCancel={() => setRedrawAllConfirm(false)}
        onConfirm={() => {
          setRedrawAllConfirm(false)
          void runGenerate('REDRAW', 'all', { onlyStale: false })
        }}
      />

      <AdminBracketImpactConfirmDialog
        open={impactConfirm !== null}
        title={impactConfirm?.title ?? ''}
        body={impactConfirm?.body ?? ''}
        affectedCount={impactConfirm?.affectedCount ?? 0}
        totalCount={impactConfirm?.totalCount ?? 0}
        affectedCategories={impactConfirm?.affectedCategoryKeys.map((categoryKey) => ({
          categoryKey,
          lockLevel: impactConfirm.lockLevels[categoryKey] ?? 'OPEN',
        })) ?? []}
        busy={busy}
        loading={impactLoading}
        confirmLabel={
          impactConfirm?.operation === 'consolidation_apply'
            ? BRACKET_IMPACT_CONFIRM.confirmApply
            : undefined
        }
        onCancel={() => setImpactConfirm(null)}
        onConfirm={() => {
          if (impactConfirm) void commitImpactOperation(impactConfirm)
        }}
      />

      {consolidationOpen && (
        <AdminBracketConsolidationDialog
          open={consolidationOpen}
          busy={busy}
          onClose={() => setConsolidationOpen(false)}
          onPreview={runConsolidationPreview}
          onRequestApply={requestConsolidationApply}
        />
      )}

      <AdminBracketBackupDialog
        open={backupOpen}
        backups={backups}
        busy={busy}
        loading={backupsLoading}
        onCancel={() => setBackupOpen(false)}
        onCreate={() => void handleCreateBackup()}
        onRestore={(backupId) => void handleRestoreBackup(backupId)}
      />

      <AdminBracketOperationOverlay operation={operation} />
    </div>
  )
}

export function AdminBracketsDashboard() {
  return (
    <AdminBracketsQueryProvider>
      <AdminBracketsDashboardInner />
    </AdminBracketsQueryProvider>
  )
}
