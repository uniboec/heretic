'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { withBasePath } from '@/lib/basePath'
import { routes } from '@/lib/routes'
import { buildTimeSortedScheduleList } from '@/lib/bouts/buildScheduleList'
import { getEffectiveAutoMatAssignMode } from '@/lib/bouts/autoMatMode'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminStatCard } from '@/components/admin/AdminStatCard'
import { type BoutsMatFilter } from '@/components/tournament/BoutsScheduleSection'
import { type BoutCardData } from '@/components/tournament/BoutCard'
import {
  AdminBoutsControlsPanel,
  type BoutsSettingsSavingSection,
} from '@/components/admin/bouts/AdminBoutsControlsPanel'
import { AdminBoutsLiveSchedule } from '@/components/admin/bouts/AdminBoutsLiveSchedule'
import { AdminBulkMoveMatModal } from '@/components/admin/bouts/AdminBulkMoveMatModal'
import { AdminBoutsScheduleTable } from '@/components/admin/bouts/AdminBoutsScheduleTable'
import { resolveBulkMoveTargetOptions } from '@/lib/bouts/resolveBulkMoveTargetOptions'
import { Button } from '@/components/ui/Button'
import { semanticAlertClasses } from '@/lib/ui/semanticSurfaceStyles'
import {
  adminBoutsCompactStatCard,
  adminBoutsCompactStatValue,
  adminBoutsPage,
  adminBoutsStatsGrid,
  adminPageActionsBtn,
  adminPanel,
} from '@/lib/ui/adminSurfaceStyles'
import type { BoutScheduleOverrides } from '@/lib/bouts/scheduleOverrides'
import type { BoutTiming, StageTimingSummary } from '@/lib/bouts/scheduleTypes'
import type { MatKey } from '@/lib/bouts/startTimes.types'
import { collectScheduledUsedStages } from '@/lib/bouts/competitionStages'
import {
  EMPTY_COMPETITION_STAGE_SETTINGS,
  type CompetitionStageSettings,
} from '@/lib/bouts/competitionStageSettings'
import {
  DISABLED_ATHLETE_PARTICIPATION_SPACING,
  type AthleteParticipationSpacing,
} from '@/lib/bouts/athleteParticipationSpacing'
interface AdminBout extends BoutCardData {
  categoryKey: string
  competitionStage: number
  timing?: BoutTiming
  isNextStartable?: boolean
}

interface AdminMat {
  matIndex: number
  configuredStartTime?: string
  estimatedEndAt?: string | null
  bouts: AdminBout[]
}

interface GroupingWarning {
  code: 'STORED_MAT_INDEX_OUT_OF_RANGE'
  categoryKey: string
  boutId: string
  storedMatIndex: number
  matCount: number
}

interface DemotionPreviewEntry {
  categoryKey: string
  matIndex: number
}

interface AdminBoutsDashboardProps {
  initialMatCount?: number
}

function boutSearchHaystack(bout: AdminBout): string {
  return [
    bout.categoryTitle,
    bout.label,
    bout.sideA.displayName,
    bout.sideA.clubName,
    bout.sideA.label,
    bout.sideB.displayName,
    bout.sideB.clubName,
    bout.sideB.label,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function formatDemotionSummary(entries: DemotionPreviewEntry[]): string {
  if (entries.length === 0) return ''
  return entries.map((entry) => `${entry.categoryKey} (площадка ${entry.matIndex})`).join(', ')
}

export function AdminBoutsDashboard({ initialMatCount = 1 }: AdminBoutsDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [publicEnabled, setPublicEnabled] = useState(false)
  const [matCount, setMatCount] = useState(initialMatCount)
  const [published, setPublished] = useState(false)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftVersion, setDraftVersion] = useState<number | null>(null)
  const [mats, setMats] = useState<AdminMat[]>([])
  const [groupingWarnings, setGroupingWarnings] = useState<GroupingWarning[]>([])
  const [boutsStartTime, setBoutsStartTime] = useState('10:00')
  const [matStartTimeOverrides, setMatStartTimeOverrides] = useState<Partial<Record<MatKey, string>>>({})
  const [boutBreakMinutes, setBoutBreakMinutes] = useState(3)
  const [athleteParticipationSpacing, setAthleteParticipationSpacing] =
    useState<AthleteParticipationSpacing>(DISABLED_ATHLETE_PARTICIPATION_SPACING)
  const [ageDivisionDurationOverrides, setAgeDivisionDurationOverrides] = useState<Record<string, number>>({})
  const [pinAllFinalsToEnd, setPinAllFinalsToEnd] = useState(false)
  const [competitionStageSettings, setCompetitionStageSettings] =
    useState<CompetitionStageSettings>(EMPTY_COMPETITION_STAGE_SETTINGS)
  const [stageSummaries, setStageSummaries] = useState<StageTimingSummary[]>([])
  const [configuredCategoryStagesFromBrackets, setConfiguredCategoryStagesFromBrackets] = useState<
    number[]
  >([1])
  const [scheduleOverrides, setScheduleOverrides] = useState<BoutScheduleOverrides>({})
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [pinCascadeDialogOpen, setPinCascadeDialogOpen] = useState(false)
  const [pendingPin, setPendingPin] = useState<{ boutIds: string[]; cascadeBoutIds: string[] } | null>(
    null,
  )
  const [selectedBoutIds, setSelectedBoutIds] = useState<Set<string>>(new Set())
  const [bulkMoveMatOpen, setBulkMoveMatOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success')
  const [matFilter, setMatFilter] = useState<BoutsMatFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [savingSection, setSavingSection] = useState<BoutsSettingsSavingSection | 'live' | null>(
    null,
  )
  const patchRequestRef = useRef(0)
  const [autoMatAssignMode, setAutoMatAssignMode] = useState<
    import('@/lib/bouts/autoMatMode').AutoMatAssignMode
  >('BY_CATEGORY')
  const [autoMatByCategoryEnabled, setAutoMatByCategoryEnabled] = useState(false)
  const effectiveAutoMatAssignMode = useMemo(
    () =>
      getEffectiveAutoMatAssignMode({
        autoMatAssignMode,
        autoMatByCategoryEnabled,
      }),
    [autoMatAssignMode, autoMatByCategoryEnabled],
  )
  const [pendingMatCount, setPendingMatCount] = useState<number | null>(null)
  const [demotionDialogOpen, setDemotionDialogOpen] = useState(false)
  const [demotionToken, setDemotionToken] = useState<string | null>(null)
  const [demotionDraftEntries, setDemotionDraftEntries] = useState<DemotionPreviewEntry[]>([])
  const [demotionPublishedEntries, setDemotionPublishedEntries] = useState<DemotionPreviewEntry[]>([])
  const [scheduleVersion, setScheduleVersion] = useState(0)
  const [scheduleLegacyGap, setScheduleLegacyGap] = useState(false)
  const [eventFinalized, setEventFinalized] = useState(false)
  const [matsEnabled, setMatsEnabled] = useState(true)
  const [snapshotAnchor, setSnapshotAnchor] = useState<{
    generatedAt: string
    receivedAt: number
  } | null>(null)
  const [countdownTick, setCountdownTick] = useState(0)

  async function refreshPreview() {
    try {
      const [boutsRes, bracketsRes] = await Promise.all([
        fetch(withBasePath('/api/admin/bouts'), { cache: 'no-store' }),
        fetch(withBasePath('/api/admin/brackets'), { cache: 'no-store' }),
      ])
      const boutsResult = await readJsonResponse<{
        generatedAt?: string
        scheduleVersion?: number
        settings?: {
          publicEnabled?: boolean
          matCount?: number
          autoMatAssignMode?: import('@/lib/bouts/autoMatMode').AutoMatAssignMode
          autoMatByCategoryEnabled?: boolean
          boutsStartTime?: string
          matStartTimeOverrides?: Partial<Record<MatKey, string>>
          boutBreakMinutes?: number
          ageDivisionDurationOverrides?: Record<string, number>
          pinAllFinalsToEnd?: boolean
          competitionStageSettings?: CompetitionStageSettings
          athleteParticipationSpacing?: AthleteParticipationSpacing
          matsEnabled?: boolean
          scheduleVersion?: number
        }
        published?: boolean
        publishedAt?: string | null
        mats?: AdminMat[]
        stageSummaries?: StageTimingSummary[]
        groupingWarnings?: GroupingWarning[]
        scheduleOverrides?: BoutScheduleOverrides
      }>(boutsRes)
      const bracketsResult = await readJsonResponse<{
        draft?: { id: string; version: number } | null
        configuredCategoryStages?: number[]
      }>(bracketsRes)

      if (!boutsResult.ok) {
        throw new Error(boutsResult.error ?? 'Не удалось загрузить поединки')
      }
      if (!bracketsResult.ok) {
        throw new Error(bracketsResult.error ?? 'Не удалось загрузить сетки')
      }

      const bouts = boutsResult.data
      const brackets = bracketsResult.data
      setPublicEnabled(Boolean(bouts.settings?.publicEnabled))
      setMatCount(bouts.settings?.matCount ?? 1)
      setAutoMatAssignMode(bouts.settings?.autoMatAssignMode ?? 'BY_CATEGORY')
      setAutoMatByCategoryEnabled(Boolean(bouts.settings?.autoMatByCategoryEnabled))
      setBoutsStartTime(bouts.settings?.boutsStartTime ?? '10:00')
      setMatStartTimeOverrides(bouts.settings?.matStartTimeOverrides ?? {})
      setBoutBreakMinutes(bouts.settings?.boutBreakMinutes ?? 3)
      setAthleteParticipationSpacing(
        bouts.settings?.athleteParticipationSpacing ?? DISABLED_ATHLETE_PARTICIPATION_SPACING,
      )
      setAgeDivisionDurationOverrides(bouts.settings?.ageDivisionDurationOverrides ?? {})
      setPinAllFinalsToEnd(Boolean(bouts.settings?.pinAllFinalsToEnd))
      setCompetitionStageSettings(
        bouts.settings?.competitionStageSettings ?? EMPTY_COMPETITION_STAGE_SETTINGS,
      )
      setPublished(Boolean(bouts.published))
      setPublishedAt(bouts.publishedAt ?? null)
      setScheduleVersion(bouts.scheduleVersion ?? bouts.settings?.scheduleVersion ?? 0)
      setScheduleLegacyGap(Boolean(bouts.scheduleLegacyGap))
      setEventFinalized(Boolean(bouts.eventFinalized))
      setMatsEnabled(bouts.settings?.matsEnabled ?? bouts.matsEnabled ?? true)
      setMats(bouts.mats ?? [])
      setStageSummaries(bouts.stageSummaries ?? [])
      setScheduleOverrides(bouts.scheduleOverrides ?? {})
      setGroupingWarnings(bouts.groupingWarnings ?? [])
      if (bouts.generatedAt) {
        setSnapshotAnchor({
          generatedAt: bouts.generatedAt,
          receivedAt: Date.now(),
        })
      }
      setDraftId(brackets.draft?.id ?? null)
      setDraftVersion(brackets.draft?.version ?? null)
      setConfiguredCategoryStagesFromBrackets(
        brackets.configuredCategoryStages?.length ? brackets.configuredCategoryStages : [1],
      )
      return bouts.scheduleVersion ?? bouts.settings?.scheduleVersion ?? 0
    } catch (error) {
      setMessageKind('error')
      setMessage(error instanceof Error ? error.message : 'Не удалось загрузить поединки')
      return scheduleVersion
    }
  }

  useEffect(() => {
    refreshPreview().finally(() => setLoading(false))
    const timer = window.setInterval(() => {
      void refreshPreview()
    }, 20_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdownTick((tick) => tick + 1)
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const referenceNow = useMemo(() => {
    if (!snapshotAnchor) return new Date()
    const generatedAtMs = new Date(snapshotAnchor.generatedAt).getTime()
    const elapsedMs = Date.now() - snapshotAnchor.receivedAt
    return new Date(generatedAtMs + elapsedMs)
  }, [snapshotAnchor, countdownTick])

  const totalBoutCount = useMemo(
    () => mats.reduce((sum, mat) => sum + mat.bouts.length, 0),
    [mats],
  )

  const configuredCategoryStages = useMemo(() => {
    const fromBrackets = configuredCategoryStagesFromBrackets
    const fromSchedule = collectScheduledUsedStages(
      mats.flatMap((mat) =>
        mat.bouts.map((bout) => ({ competitionStage: bout.competitionStage ?? 1 })),
      ),
    )
    const merged = [...new Set([...fromBrackets, ...fromSchedule])].sort((a, b) => a - b)
    return merged.length > 0 ? merged : [1]
  }, [configuredCategoryStagesFromBrackets, mats])

  const inProgressCount = useMemo(
    () =>
      mats
        .flatMap((mat) => mat.bouts)
        .filter((bout) => bout.timing?.displayStatus === 'in_progress').length,
    [mats],
  )

  const visibleBouts = useMemo(() => {
    if (matFilter === 'all') {
      return buildTimeSortedScheduleList(mats)
    }
    return mats.find((mat) => mat.matIndex === matFilter)?.bouts ?? []
  }, [matFilter, mats])

  const filteredBouts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return visibleBouts
    return visibleBouts.filter((bout) => boutSearchHaystack(bout).includes(query))
  }, [searchQuery, visibleBouts])

  const bulkSelectionEnabled = published && searchQuery.trim().length === 0

  const selectedBouts = useMemo(
    () => filteredBouts.filter((bout) => selectedBoutIds.has(bout.id)),
    [filteredBouts, selectedBoutIds],
  )

  const bulkMoveTargetOptions = useMemo(
    () => resolveBulkMoveTargetOptions(selectedBouts, matCount),
    [selectedBouts, matCount],
  )

  useEffect(() => {
    setSelectedBoutIds(new Set())
  }, [matFilter, searchQuery])

  const scheduleEmptyTitle = useMemo(() => {
    if (filteredBouts.length === 0 && visibleBouts.length > 0 && searchQuery.trim()) {
      return 'Ничего не найдено'
    }
    if (published) {
      return matFilter === 'all'
        ? 'Поединков пока нет'
        : `На ковре ${matFilter} пока нет поединков`
    }
    return 'Нет опубликованного расписания'
  }, [filteredBouts.length, matFilter, published, searchQuery, visibleBouts.length])

  const scheduleEmptyDescription = useMemo(() => {
    if (filteredBouts.length === 0 && visibleBouts.length > 0 && searchQuery.trim()) {
      return 'Измените запрос или сбросьте фильтры, чтобы увидеть расписание.'
    }
    if (published) {
      return 'Когда появятся опубликованные сетки с видимыми категориями, поединки отобразятся здесь.'
    }
    return 'Опубликуйте сетки и включите видимость категорий на странице «Сетки».'
  }, [filteredBouts.length, published, searchQuery, visibleBouts.length])

  function applyPatchResult(json: {
    draft?: { id: string; version: number }
    settings?: {
      publicEnabled: boolean
      matCount: number
      matsEnabled?: boolean
      scheduleVersion?: number
      autoMatAssignMode?: import('@/lib/bouts/autoMatMode').AutoMatAssignMode
      autoMatByCategoryEnabled?: boolean
    }
    scheduleVersion?: number
    matCountChange?: {
      recomputedReleasedCategoryCount: number
      reassignedAutoCategoryCount: number
      demotedCategoryCount: number
    } | null
    modeChange?: {
      recomputedReleasedCategoryCount: number
      reassignedAutoCategoryCount: number
    } | null
  }) {
    if (json.draft) {
      setDraftId(json.draft.id)
      setDraftVersion(json.draft.version)
    }
    if (json.settings) {
      setPublicEnabled(json.settings.publicEnabled)
      setMatCount(json.settings.matCount)
      if (typeof json.settings.matsEnabled === 'boolean') {
        setMatsEnabled(json.settings.matsEnabled)
      }
      setAutoMatAssignMode(json.settings.autoMatAssignMode ?? 'BY_CATEGORY')
      setAutoMatByCategoryEnabled(Boolean(json.settings.autoMatByCategoryEnabled))
    }
    if (typeof json.scheduleVersion === 'number') {
      setScheduleVersion(json.scheduleVersion)
    } else if (typeof json.settings?.scheduleVersion === 'number') {
      setScheduleVersion(json.settings.scheduleVersion)
    }
    if (json.matCountChange && json.matCountChange.recomputedReleasedCategoryCount > 0) {
      const demoted =
        json.matCountChange.demotedCategoryCount > 0
          ? ` ${json.matCountChange.demotedCategoryCount} Fixed-категорий переведены в Auto.`
          : ''
      setMessageKind('success')
      setMessage(
        `Число площадок изменено. Пересчитано ${json.matCountChange.recomputedReleasedCategoryCount} released-категорий.${demoted}`,
      )
    } else if (json.modeChange && json.modeChange.recomputedReleasedCategoryCount > 0) {
      setMessageKind('success')
      setMessage(
        `Режим Auto изменён. Перераспределено ${json.modeChange.recomputedReleasedCategoryCount} категорий на площадках.`,
      )
    } else {
      setMessage(null)
    }
  }

  async function patchSettings(
    body: Record<string, unknown>,
    options?: { silentSuccess?: boolean },
  ) {
    const requestId = ++patchRequestRef.current
    const response = await fetch(withBasePath('/api/admin/bouts/settings'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        expectedScheduleVersion: scheduleVersion,
        ...(draftId != null && draftVersion != null
          ? { draftId, expectedVersion: draftVersion }
          : {}),
      }),
    })
    const result = await readJsonResponse<{
      error?: string
      code?: string
      draft?: { id: string; version: number }
      settings?: {
        publicEnabled: boolean
        matCount: number
        matsEnabled?: boolean
        scheduleVersion?: number
        autoMatAssignMode?: import('@/lib/bouts/autoMatMode').AutoMatAssignMode
        autoMatByCategoryEnabled?: boolean
      }
      scheduleVersion?: number
      matCountChange?: {
        recomputedReleasedCategoryCount: number
        reassignedAutoCategoryCount: number
        demotedCategoryCount: number
      } | null
      modeChange?: {
        recomputedReleasedCategoryCount: number
        reassignedAutoCategoryCount: number
      } | null
      demotionToken?: string
      draftEntries?: DemotionPreviewEntry[]
      publishedEntries?: DemotionPreviewEntry[]
    }>(response)

    if (result.ok) {
      if (requestId !== patchRequestRef.current) {
        return true
      }
      if (options?.silentSuccess) {
        if (result.data.draft) {
          setDraftId(result.data.draft.id)
          setDraftVersion(result.data.draft.version)
        }
        if (result.data.settings) {
          setPublicEnabled(result.data.settings.publicEnabled)
          setMatCount(result.data.settings.matCount)
          if (typeof result.data.settings.matsEnabled === 'boolean') {
            setMatsEnabled(result.data.settings.matsEnabled)
          }
          setAutoMatAssignMode(result.data.settings.autoMatAssignMode ?? 'BY_CATEGORY')
          setAutoMatByCategoryEnabled(Boolean(result.data.settings.autoMatByCategoryEnabled))
        }
        if (typeof result.data.scheduleVersion === 'number') {
          setScheduleVersion(result.data.scheduleVersion)
        } else if (typeof result.data.settings?.scheduleVersion === 'number') {
          setScheduleVersion(result.data.settings.scheduleVersion)
        }
      } else {
        applyPatchResult(result.data)
      }
      await refreshPreview()
      return true
    }

    const errorBody = result.body as {
      code?: string
      demotionToken?: string
      draftEntries?: DemotionPreviewEntry[]
      publishedEntries?: DemotionPreviewEntry[]
    } | undefined

    if (
      response.status === 409 &&
      errorBody?.code === 'MAT_COUNT_DEMOTION_CONFIRMATION_REQUIRED' &&
      typeof errorBody.demotionToken === 'string'
    ) {
      setDemotionToken(errorBody.demotionToken)
      setDemotionDraftEntries(errorBody.draftEntries ?? [])
      setDemotionPublishedEntries(errorBody.publishedEntries ?? [])
      setDemotionDialogOpen(true)
      return false
    }

    if (
      response.status === 409 &&
      (errorBody?.code === 'VERSION_CONFLICT' || errorBody?.code === 'DRAFT_ID_CONFLICT')
    ) {
      setMessageKind('error')
      setMessage(result.error ?? 'Черновик изменился. Обновите страницу.')
      await refreshPreview()
      return false
    }

    setMessageKind('error')
    setMessage(result.error ?? 'Не удалось сохранить настройки')
    return false
  }

  async function saveSettings(
    next: {
      publicEnabled?: boolean
      matCount?: number
      autoMatAssignMode?: import('@/lib/bouts/autoMatMode').AutoMatAssignMode
      pinAllFinalsToEnd?: boolean
      confirmFixedDemotion?: boolean
      demotionToken?: string
    },
    section: BoutsSettingsSavingSection,
  ) {
    if (next.matCount !== undefined && (!draftId || draftVersion == null)) {
      setMessageKind('error')
      setMessage('Для изменения числа площадок нужен активный черновик сеток.')
      return
    }
    setSavingSection(section)
    try {
      if (next.matCount !== undefined && !next.confirmFixedDemotion) {
        const previewUrl = new URL(withBasePath('/api/admin/bouts/settings/mat-count-preview'), window.location.origin)
        previewUrl.searchParams.set('matCount', String(next.matCount))
        previewUrl.searchParams.set('draftId', draftId!)
        previewUrl.searchParams.set('expectedVersion', String(draftVersion))
        const previewRes = await fetch(previewUrl.toString())
        const previewResult = await readJsonResponse<{
          needsConfirmation?: boolean
          demotionToken?: string | null
          draftEntries?: DemotionPreviewEntry[]
          publishedEntries?: DemotionPreviewEntry[]
        }>(previewRes)
        if (previewResult.ok && previewResult.data.needsConfirmation && previewResult.data.demotionToken) {
          setPendingMatCount(next.matCount)
          setDemotionToken(previewResult.data.demotionToken)
          setDemotionDraftEntries(previewResult.data.draftEntries ?? [])
          setDemotionPublishedEntries(previewResult.data.publishedEntries ?? [])
          setDemotionDialogOpen(true)
          return
        }
      }

      await patchSettings(next)
    } finally {
      setSavingSection(null)
    }
  }

  async function saveTimingSettings(
    body: Record<string, unknown>,
    section: 'timing' | 'advanced',
  ): Promise<boolean> {
    setSavingSection(section)
    try {
      return await patchSettings(body, { silentSuccess: true })
    } finally {
      setSavingSection(null)
    }
  }

  const scheduleControlsEnabled =
    published && matFilter !== 'all' && searchQuery.trim().length === 0

  async function patchScheduleOverrides(body: Record<string, unknown>): Promise<boolean> {
    setScheduleSaving(true)
    try {
      let expectedScheduleVersion = scheduleVersion

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(withBasePath('/api/admin/bouts/schedule-overrides'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            expectedScheduleVersion,
          }),
        })
        const result = await readJsonResponse<{
          error?: string
          code?: string
          cascadeBoutIds?: string[]
          scheduleVersion?: number
          errors?: Array<{ message?: string }>
        }>(response)
        if (!result.ok) {
          if (result.body?.code === 'SCHEDULE_VERSION_CONFLICT' && attempt === 0) {
            expectedScheduleVersion = await refreshPreview()
            continue
          }

          if (response.status === 409 && result.body?.code === 'PIN_CASCADE_CONFIRMATION_REQUIRED') {
            const boutIds = Array.isArray(body.boutIds)
              ? body.boutIds.filter((value): value is string => typeof value === 'string')
              : typeof body.boutId === 'string'
                ? [body.boutId]
                : []
            if (boutIds.length > 0) {
              setPendingPin({
                boutIds,
                cascadeBoutIds: result.body.cascadeBoutIds ?? [],
              })
              setPinCascadeDialogOpen(true)
              return false
            }
          }
          const issueMessage =
            result.body?.errors?.[0]?.message ??
            (typeof result.body?.error === 'string' ? result.body.error : undefined)
          setMessageKind('error')
          setMessage(issueMessage ?? result.error ?? 'Не удалось обновить порядок поединков')
          return false
        }
        if (typeof result.body?.scheduleVersion === 'number') {
          setScheduleVersion(result.body.scheduleVersion)
        }
        setMessageKind('success')
        setMessage('Порядок поединков обновлён')
        await refreshPreview()
        return true
      }

      return false
    } finally {
      setScheduleSaving(false)
    }
  }

  function rejectCrossStageMove(sourceId: string, targetId: string): boolean {
    const source = filteredBouts.find((bout) => bout.id === sourceId)
    const target = filteredBouts.find((bout) => bout.id === targetId)
    if (!source || !target || source.competitionStage === target.competitionStage) return false
    setMessageKind('error')
    setMessage(
      'Перестановка возможна только внутри одного этапа. Измените «Этап проведения» у категории в разделе «Сетки».',
    )
    return true
  }

  async function moveBoutOnMat(boutId: string, direction: 'up' | 'down') {
    if (matFilter === 'all') return
    const mat = mats.find((entry) => entry.matIndex === matFilter)
    if (!mat) return
    const orderedIds = mat.bouts.map((bout) => bout.id)
    const index = orderedIds.indexOf(boutId)
    if (index < 0) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= orderedIds.length) return
    if (rejectCrossStageMove(boutId, orderedIds[targetIndex]!)) return
    const nextOrder = [...orderedIds]
    const [removed] = nextOrder.splice(index, 1)
    nextOrder.splice(targetIndex, 0, removed!)
    await patchScheduleOverrides({
      matIndex: matFilter,
      orderedBoutIds: nextOrder,
    })
  }

  async function resetMatManualOrder() {
    if (matFilter === 'all') return
    await patchScheduleOverrides({
      action: 'reset_manual_order',
      matIndex: matFilter,
    })
  }

  async function reorderMatBouts(orderedBoutIds: string[]) {
    if (matFilter === 'all') return
    await patchScheduleOverrides({
      matIndex: matFilter,
      orderedBoutIds,
    })
  }

  async function toggleBoutPin(boutId: string, pinnedToEnd: boolean, confirmCascade = false) {
    if (!pinnedToEnd) {
      await patchScheduleOverrides({
        action: 'pin',
        boutId,
        pinnedToEnd,
      })
      return
    }
    await patchScheduleOverrides({
      action: 'pin',
      boutId,
      pinnedToEnd,
      ...(confirmCascade ? { confirmCascade: true } : {}),
    })
  }

  async function confirmPinCascade() {
    if (!pendingPin) return
    setPinCascadeDialogOpen(false)
    const ok = await patchScheduleOverrides(
      pendingPin.boutIds.length === 1
        ? {
            action: 'pin',
            boutId: pendingPin.boutIds[0]!,
            pinnedToEnd: true,
            confirmCascade: true,
          }
        : {
            action: 'pin_bulk',
            boutIds: pendingPin.boutIds,
            pinnedToEnd: true,
            confirmCascade: true,
          },
    )
    if (ok) {
      setPendingPin(null)
      setSelectedBoutIds(new Set())
    }
  }

  function toggleBoutSelection(boutId: string, selected: boolean) {
    setSelectedBoutIds((current) => {
      const next = new Set(current)
      if (selected) next.add(boutId)
      else next.delete(boutId)
      return next
    })
  }

  function toggleAllVisibleSelection(boutIds: string[], selected: boolean) {
    setSelectedBoutIds((current) => {
      const next = new Set(current)
      for (const boutId of boutIds) {
        if (selected) next.add(boutId)
        else next.delete(boutId)
      }
      return next
    })
  }

  async function bulkPinSelected(pinnedToEnd: boolean, confirmCascade = false) {
    const boutIds = [...selectedBoutIds]
    if (boutIds.length === 0) return
    const ok = await patchScheduleOverrides(
      boutIds.length === 1
        ? {
            action: 'pin',
            boutId: boutIds[0]!,
            pinnedToEnd,
            ...(confirmCascade ? { confirmCascade: true } : {}),
          }
        : {
            action: 'pin_bulk',
            boutIds,
            pinnedToEnd,
            ...(confirmCascade ? { confirmCascade: true } : {}),
          },
    )
    if (ok) setSelectedBoutIds(new Set())
  }

  async function bulkMoveSelectedToMat(targetMatIndex: number) {
    const boutIds = [...selectedBoutIds]
    if (boutIds.length === 0) return
    setScheduleSaving(true)
    try {
      let expectedScheduleVersion = scheduleVersion

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(withBasePath('/api/admin/bouts/schedule-overrides'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'move_mat_bulk',
            boutIds,
            targetMatIndex,
            expectedScheduleVersion,
          }),
        })
        const result = await readJsonResponse<{
          error?: string
          code?: string
          scheduleVersion?: number
          errors?: Array<{ message?: string }>
        }>(response)
        if (!result.ok) {
          if (result.body?.code === 'SCHEDULE_VERSION_CONFLICT' && attempt === 0) {
            expectedScheduleVersion = await refreshPreview()
            continue
          }
          const issueMessage = result.body?.errors?.[0]?.message
          setMessageKind('error')
          setMessage(issueMessage ?? result.error ?? 'Не удалось перенести поединки')
          return
        }
        if (typeof result.body?.scheduleVersion === 'number') {
          setScheduleVersion(result.body.scheduleVersion)
        }
        setMessageKind('success')
        setMessage('Поединки перенесены на другой ковёр')
        setBulkMoveMatOpen(false)
        setSelectedBoutIds(new Set())
        await refreshPreview()
        return
      }
    } finally {
      setScheduleSaving(false)
    }
  }

  async function postExecution(path: string, body: Record<string, unknown>) {
    setSavingSection('live')
    try {
      const payload = path.includes('/executions/start')
        ? {
            ...body,
            mutationId: crypto.randomUUID(),
            expectedScheduleVersion: scheduleVersion,
          }
        : body
      const response = await fetch(withBasePath(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await readJsonResponse<{
        error?: string
        scheduleVersion?: number
      }>(response)
      if (!result.ok) {
        setMessageKind('error')
        setMessage(result.error ?? 'Не удалось выполнить действие')
        return
      }
      if (typeof result.data?.scheduleVersion === 'number') {
        setScheduleVersion(result.data.scheduleVersion)
      }
      setMessageKind('success')
      setMessage('Live-расписание обновлено')
      await refreshPreview()
    } finally {
      setSavingSection(null)
    }
  }

  async function confirmMatCountChange() {
    if (pendingMatCount == null || !demotionToken) return
    setSavingSection('core')
    setDemotionDialogOpen(false)
    try {
      await patchSettings({
        matCount: pendingMatCount,
        confirmFixedDemotion: true,
        demotionToken,
      })
    } finally {
      setPendingMatCount(null)
      setDemotionToken(null)
      setSavingSection(null)
    }
  }

  const liveSaving = savingSection === 'live'

  if (loading) {
    return (
      <div className={adminBoutsPage}>
        <AdminPageHeader title="Поединки" description="Расписание боёв по коврам" />
        <section className={`${adminPanel} p-4`}>
          <p className="text-sm text-muted">Загрузка поединков…</p>
        </section>
      </div>
    )
  }

  const demotionSummary = [
    formatDemotionSummary(demotionDraftEntries),
    formatDemotionSummary(demotionPublishedEntries),
  ]
    .filter(Boolean)
    .join('; ')

  const liveMats = mats.filter(
    (mat): mat is AdminMat & { configuredStartTime: string; bouts: Array<AdminBout & { timing: BoutTiming }> } =>
      Boolean(mat.configuredStartTime) &&
      mat.bouts.every((bout): bout is AdminBout & { timing: BoutTiming } => Boolean(bout.timing)),
  )

  return (
    <div className={adminBoutsPage}>
      <AdminPageHeader
        title="Поединки"
        description={
          publishedAt
            ? `Расписание боёв по коврам · опубликовано ${new Date(publishedAt).toLocaleString('ru-RU')}`
            : 'Расписание боёв по коврам'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={withBasePath(routes.admin.boutsAudit)}>
              <Button variant="secondary" className={adminPageActionsBtn}>
                Аудит mat-control
              </Button>
            </Link>
            <Link href={withBasePath(routes.admin.boutsReconciliation)}>
              <Button variant="secondary" className={adminPageActionsBtn}>
                Сверка mat-control
              </Button>
            </Link>
            {matCount > 0 ? (
              matCount === 1 ? (
                <>
                  <Link href={withBasePath('/admin/bouts/mats/1/control')}>
                    <Button variant="secondary" className={adminPageActionsBtn}>
                      Открыть рабочее место
                    </Button>
                  </Link>
                  <Link href={withBasePath(routes.scoreboard(1))} target="_blank" rel="noopener noreferrer">
                    <Button variant="secondary" className={adminPageActionsBtn}>
                      Табло ковра
                    </Button>
                  </Link>
                </>
              ) : (
                Array.from({ length: matCount }, (_, index) => index + 1).map((matIndex) => (
                  <span key={matIndex} className="inline-flex flex-wrap gap-2">
                    <Link href={withBasePath(`/admin/bouts/mats/${matIndex}/control`)}>
                      <Button variant="secondary" className={adminPageActionsBtn}>
                        Ковёр {matIndex}
                      </Button>
                    </Link>
                    <Link
                      href={withBasePath(routes.scoreboard(matIndex))}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="secondary" className={adminPageActionsBtn}>
                        Табло {matIndex}
                      </Button>
                    </Link>
                  </span>
                ))
              )
            ) : null}
            <Link href={withBasePath(routes.bouts)} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" className={`${adminPageActionsBtn} gap-2`}>
                <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Публичная страница
              </Button>
            </Link>
          </div>
        }
      />

      <section
        className={`${adminBoutsStatsGrid} sm:grid-cols-3`}
        aria-label="Сводка по поединкам"
      >
        <AdminStatCard label="Поединков" value={String(totalBoutCount)} className={adminBoutsCompactStatCard} valueClassName={adminBoutsCompactStatValue} />
        <AdminStatCard label="Ковров" value={String(matCount)} className={adminBoutsCompactStatCard} valueClassName={adminBoutsCompactStatValue} />
        <AdminStatCard label="Идёт" value={String(inProgressCount)} className={adminBoutsCompactStatCard} valueClassName={adminBoutsCompactStatValue} />
      </section>

      {message && (
        <div
          className={messageKind === 'success' ? semanticAlertClasses.success : semanticAlertClasses.danger}
          role="status"
        >
          {message}
        </div>
      )}

      {eventFinalized && (
        <div className={semanticAlertClasses.info} role="status">
          Мероприятие завершено: mat control и правки расписания заблокированы. Публичные итоги доступны
          на сайте.
        </div>
      )}

      {scheduleLegacyGap && (
        <div className={semanticAlertClasses.warning} role="status">
          Режим legacy schedule gap активен: номера в замороженном префиксе могут не проходить проверку
          уникальности. Запустите{' '}
          <code className="rounded bg-background-soft px-1 py-0.5 text-xs">repair-schedule-legacy.ts</code>{' '}
          и снимите флаг после rebuild.
        </div>
      )}

      {pinCascadeDialogOpen && pendingPin && (
        <div className={semanticAlertClasses.warning}>
          <p className="font-semibold">Закрепить поединок и зависимые бои в конце?</p>
          <p className="mt-2 text-sm">
            Закрепление затронет {pendingPin.boutIds.length + pendingPin.cascadeBoutIds.length}{' '}
            поединков в сетке (включая зависимые стадии).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" disabled={scheduleSaving} onClick={() => void confirmPinCascade()}>
              Подтвердить
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={scheduleSaving}
              onClick={() => {
                setPinCascadeDialogOpen(false)
                setPendingPin(null)
              }}
            >
              Отмена
            </Button>
          </div>
        </div>
      )}

      {demotionDialogOpen && (
        <div className={semanticAlertClasses.warning}>
          <p className="font-semibold">Подтвердите перевод Fixed-категорий в Auto</p>
          <p className="mt-2">
            Следующие категории выходят за пределы нового числа площадок и будут переведены в Auto:{' '}
            {demotionSummary || '—'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" disabled={savingSection !== null} onClick={() => void confirmMatCountChange()}>
              Подтвердить
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={savingSection !== null}
              onClick={() => {
                setDemotionDialogOpen(false)
                setPendingMatCount(null)
                setDemotionToken(null)
              }}
            >
              Отмена
            </Button>
          </div>
        </div>
      )}

      {!published && (
        <div className={semanticAlertClasses.warning} role="status">
          Нет опубликованного снимка сеток — превью поединков пустое. Сначала зафиксируйте снимок на
          странице «Сетки» и включите видимость категорий.
        </div>
      )}

      {groupingWarnings.length > 0 && (
        <div className={semanticAlertClasses.warning}>
          <p className="font-semibold">Площадки категорий не совпадают с числом площадок</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {groupingWarnings.map((warning) => (
              <li key={`${warning.boutId}-${warning.storedMatIndex}`}>
                Категория {warning.categoryKey}: назначена площадка {warning.storedMatIndex}, но доступно{' '}
                {warning.matCount}. Поединки показаны на площадке 1.
              </li>
            ))}
          </ul>
        </div>
      )}

      <AdminBoutsControlsPanel
        publicEnabled={publicEnabled}
        matCount={matCount}
        matsEnabled={matsEnabled}
        autoMatAssignMode={autoMatAssignMode}
        effectiveAutoMatAssignMode={effectiveAutoMatAssignMode}
        autoMatByCategoryEnabled={autoMatByCategoryEnabled}
        savingSection={savingSection === 'live' ? null : savingSection}
        boutsStartTime={boutsStartTime}
        matStartTimeOverrides={matStartTimeOverrides}
        boutBreakMinutes={boutBreakMinutes}
        athleteParticipationSpacing={athleteParticipationSpacing}
        ageDivisionDurationOverrides={ageDivisionDurationOverrides}
        pinAllFinalsToEnd={pinAllFinalsToEnd}
        competitionStageSettings={competitionStageSettings}
        configuredCategoryStages={configuredCategoryStages}
        stageSummaries={stageSummaries}
        onSaveSettings={saveSettings}
        onSaveTiming={saveTimingSettings}
      />

      <AdminBoutsScheduleTable
        mats={mats}
        matCount={matCount}
        totalBoutCount={totalBoutCount}
        matFilter={matFilter}
        onMatFilterChange={setMatFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        filteredBouts={filteredBouts}
        stageSummaries={stageSummaries}
        showMatColumn={matFilter === 'all' && matCount > 1}
        emptyTitle={scheduleEmptyTitle}
        emptyDescription={scheduleEmptyDescription}
        referenceNow={referenceNow}
        scheduleControlsEnabled={scheduleControlsEnabled}
        scheduleOverrides={scheduleOverrides}
        scheduleSaving={scheduleSaving}
        onMoveBout={(boutId, direction) => void moveBoutOnMat(boutId, direction)}
        onReorderMat={(orderedBoutIds) => void reorderMatBouts(orderedBoutIds)}
        onResetManualOrder={() => void resetMatManualOrder()}
        onTogglePin={(boutId, pinned) => void toggleBoutPin(boutId, pinned)}
        onReorderRejected={(message) => {
          setMessageKind('error')
          setMessage(message)
        }}
        bulkSelectionEnabled={bulkSelectionEnabled}
        selectedBoutIds={selectedBoutIds}
        onToggleBoutSelection={toggleBoutSelection}
        onToggleAllVisibleSelection={toggleAllVisibleSelection}
        onBulkPin={() => void bulkPinSelected(true)}
        onBulkUnpin={() => void bulkPinSelected(false)}
        onBulkMoveMat={() => setBulkMoveMatOpen(true)}
        bulkMoveMatEnabled={matCount > 1 && bulkMoveTargetOptions.length > 0}
      />

      <AdminBulkMoveMatModal
        open={bulkMoveMatOpen}
        busy={scheduleSaving}
        selectedCount={selectedBoutIds.size}
        targetMats={bulkMoveTargetOptions}
        onClose={() => setBulkMoveMatOpen(false)}
        onConfirm={bulkMoveSelectedToMat}
      />

      <AdminBoutsLiveSchedule
        mats={liveMats}
        stageSummaries={stageSummaries}
        saving={liveSaving}
        onStart={(boutId, matIndex) =>
          postExecution('/api/admin/bouts/executions/start', { boutId, matIndex })
        }
        onComplete={(boutId, matIndex) =>
          postExecution('/api/admin/bouts/executions/complete', { boutId, matIndex })
        }
        onUndo={(boutId, matIndex) =>
          postExecution(`/api/admin/bouts/executions/${boutId}/undo-completion`, { matIndex })
        }
      />
    </div>
  )
}
