'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ExternalLink, MessageSquare } from 'lucide-react'
import { withBasePath } from '@/lib/basePath'
import { routes } from '@/lib/routes'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Button } from '@/components/ui/Button'
import { semanticAlertClasses } from '@/lib/ui/semanticSurfaceStyles'
import {
  adminBoutsPage,
  adminCompactActionBtn,
  adminPageActionsBtn,
} from '@/lib/ui/adminSurfaceStyles'
import {
  awardsAdminActionAward,
  awardsAdminActionBtn,
  awardsAdminCategoryActions,
  awardsAdminCategoryCard,
  awardsAdminCategoryHead,
  awardsAdminCategoryMeta,
  awardsAdminCategoryTitle,
  awardsAdminIconBtn,
  awardsAdminIconBtnActive,
  awardsAdminPlacements,
  awardsAdminProgressFill,
  awardsAdminProgressTrack,
  awardsAdminRemainingItem,
  awardsAdminTab,
  awardsAdminTabs,
  awardsCategoryStatusLabel,
  awardsMedalBadge,
} from '@/lib/ui/awardsUiClasses'
import { useAnimatedResolve } from '@/lib/hooks/useAnimatedResolve'
import { awardsConflictMessage } from '@/lib/awards/adminErrors'
import type { AdminAwardsDashboard as AdminAwardsDashboardData } from '@/lib/awards/dto/admin'
import { cn } from '@/lib/cn'
import { AdminAwardsControlsPanel } from './AdminAwardsControlsPanel'
import { AwardsCommentsModal } from './AwardsCommentsModal'
import { AdminAwardPlacementRow } from './AdminAwardPlacementRow'
import { AwardsBulkCompleteConfirmModal } from './AwardsBulkCompleteConfirmModal'
import { ViewBracketCategoryButton } from '@/components/tournament/brackets/ViewBracketCategoryButton'

function createOperationId(): string {
  return crypto.randomUUID()
}

type AwardCategory = AdminAwardsDashboardData['queue'][number]

type CommentsTarget =
  | { kind: 'category'; category: AwardCategory }
  | { kind: 'placement'; category: AwardCategory; placement: AwardCategory['placements'][number] }

type CommentDraft = { admin: string; public: string }

function resolvedCount(category: AwardCategory): number {
  return category.placements.filter((p) => p.status !== 'PENDING').length
}

export function AdminAwardsDashboard() {
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<AdminAwardsDashboardData | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'queue' | 'completed' | 'remaining' | 'review'>('queue')
  const [commentsTarget, setCommentsTarget] = useState<CommentsTarget | null>(null)
  const [bulkCompleteTarget, setBulkCompleteTarget] = useState<AwardCategory | null>(null)
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, CommentDraft>>({})
  const [placementDrafts, setPlacementDrafts] = useState<Record<string, CommentDraft>>({})
  const { animating, runAnimated } = useAnimatedResolve()
  const entranceDone = useRef(false)

  const syncDrafts = useCallback((data: AdminAwardsDashboardData) => {
    const nextCategoryDrafts: Record<string, CommentDraft> = {}
    const nextPlacementDrafts: Record<string, CommentDraft> = {}
    for (const category of [...data.queue, ...data.completed, ...data.needsReview]) {
      nextCategoryDrafts[category.queueId] = {
        admin: category.adminComment ?? '',
        public: category.publicComment ?? '',
      }
      for (const placement of category.placements) {
        nextPlacementDrafts[placement.id] = {
          admin: placement.adminComment ?? '',
          public: placement.publicComment ?? '',
        }
      }
    }
    setCategoryDrafts(nextCategoryDrafts)
    setPlacementDrafts(nextPlacementDrafts)
  }, [])

  const loadDashboard = useCallback(async () => {
    const response = await fetch(withBasePath('/api/admin/awards'), { cache: 'no-store' })
    const result = await readJsonResponse<AdminAwardsDashboardData>(response)
    if (!result.ok || !result.data) {
      throw new Error('Failed to load awards dashboard')
    }
    setDashboard(result.data)
    syncDrafts(result.data)
  }, [syncDrafts])

  useEffect(() => {
    void loadDashboard()
      .catch(() => {
        setMessage('Не удалось загрузить данные награждения')
        setMessageKind('error')
      })
      .finally(() => {
        setLoading(false)
        window.setTimeout(() => {
          entranceDone.current = true
        }, 600)
      })
  }, [loadDashboard])

  function handleConflict(status: number, body: unknown) {
    if (status === 409) {
      void loadDashboard()
      setMessage(awardsConflictMessage(body))
      setMessageKind('error')
      return true
    }
    return false
  }

  function applyCategoryRevision(queueId: string, revision: number, queueRevision?: number) {
    setDashboard((current) => {
      if (!current) return current
      const patch = (category: AwardCategory) =>
        category.queueId === queueId ? { ...category, revision } : category
      return {
        ...current,
        ...(queueRevision !== undefined ? { queueRevision } : {}),
        queue: current.queue.map(patch),
        completed: current.completed.map(patch),
        needsReview: current.needsReview.map(patch),
      }
    })
  }

  function applyPlacementOptimistic(
    queueId: string,
    placementId: string,
    status: 'AWARDED' | 'NOT_AWARDED' | 'PENDING',
    revision: number,
    queueRevision?: number,
  ) {
    setDashboard((current) => {
      if (!current) return current
      const patchCategory = (category: AwardCategory): AwardCategory => {
        if (category.queueId !== queueId) return category
        return {
          ...category,
          revision,
          placements: category.placements.map((placement) =>
            placement.id === placementId
              ? {
                  ...placement,
                  status,
                  resolvedAt: status === 'PENDING' ? null : new Date().toISOString(),
                }
              : placement,
          ),
        }
      }
      return {
        ...current,
        ...(queueRevision !== undefined ? { queueRevision } : {}),
        queue: current.queue.map(patchCategory),
        completed: current.completed.map(patchCategory),
        needsReview: current.needsReview.map(patchCategory),
      }
    })
  }

  async function savePublicEnabled(value: boolean) {
    setSaving(true)
    try {
      const response = await fetch(withBasePath('/api/admin/awards/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicEnabled: value }),
      })
      const result = await readJsonResponse(response)
      if (!result.ok) {
        if (handleConflict(result.status, result.body)) return
        throw new Error('Не удалось сохранить настройки')
      }
      await loadDashboard()
      setMessage('Настройки сохранены')
      setMessageKind('success')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ошибка сохранения')
      setMessageKind('error')
    } finally {
      setSaving(false)
    }
  }

  async function saveTiming(patch: {
    ceremonyStartTime: string
    ceremonyDurationMinutes: number
    ceremonyBreakMinutes: number
  }): Promise<boolean> {
    setSaving(true)
    try {
      const response = await fetch(withBasePath('/api/admin/awards/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const result = await readJsonResponse(response)
      if (!result.ok) {
        if (handleConflict(result.status, result.body)) return false
        throw new Error('Не удалось сохранить расписание')
      }
      await loadDashboard()
      setMessage('Расписание сохранено')
      setMessageKind('success')
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ошибка сохранения')
      setMessageKind('error')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function patchPlacement(
    category: AwardCategory,
    placementId: string,
    status: 'AWARDED' | 'NOT_AWARDED' | 'PENDING',
  ) {
    const response = await fetch(withBasePath(`/api/admin/awards/placements/${placementId}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId: createOperationId(),
        expectedRevision: category.revision,
        status,
      }),
    })
    const result = await readJsonResponse<{ revision: number; queueRevision?: number }>(response)
    if (!result.ok) {
      if (handleConflict(result.status, result.body)) return
      throw new Error('Не удалось обновить статус')
    }
    if (!result.data) return

    applyPlacementOptimistic(
      category.queueId,
      placementId,
      status,
      result.data.revision,
      result.data.queueRevision,
    )

    const allResolved = category.placements.every((p) =>
      p.id === placementId ? status !== 'PENDING' : p.status !== 'PENDING',
    )
    const categoryMayMove =
      allResolved ||
      category.status === 'COMPLETED' ||
      (category.status === 'PENDING' && status !== 'PENDING')

    if (categoryMayMove) {
      await loadDashboard()
    } else {
      applyCategoryRevision(category.queueId, result.data.revision, result.data.queueRevision)
    }
  }

  async function updatePlacement(
    category: AwardCategory,
    placementId: string,
    status: 'AWARDED' | 'NOT_AWARDED' | 'PENDING',
  ) {
    try {
      if (status === 'PENDING') {
        await patchPlacement(category, placementId, status)
        return
      }
      await runAnimated(
        placementId,
        () => patchPlacement(category, placementId, status),
        status === 'AWARDED' ? 'success' : 'skip',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ошибка обновления')
      setMessageKind('error')
    }
  }

  async function saveCategoryComments(category: AwardCategory, adminComment: string, publicComment: string) {
    setSaving(true)
    try {
      const response = await fetch(withBasePath('/api/admin/awards/comment'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId: createOperationId(),
          queueId: category.queueId,
          expectedRevision: category.revision,
          adminComment,
          publicComment,
        }),
      })
      const result = await readJsonResponse<{ revision: number }>(response)
      if (!result.ok) {
        if (handleConflict(result.status, result.body)) return
        throw new Error('Не удалось сохранить комментарий')
      }
      if (result.data) {
        applyCategoryRevision(category.queueId, result.data.revision)
      }
      setCategoryDrafts((current) => ({
        ...current,
        [category.queueId]: { admin: adminComment, public: publicComment },
      }))
      setCommentsTarget(null)
      setMessage('Комментарий категории сохранён')
      setMessageKind('success')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ошибка сохранения комментария')
      setMessageKind('error')
    } finally {
      setSaving(false)
    }
  }

  async function savePlacementComment(
    category: AwardCategory,
    placementId: string,
    adminComment: string,
    publicComment: string,
  ) {
    setSaving(true)
    try {
      const response = await fetch(withBasePath(`/api/admin/awards/placements/${placementId}/comment`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId: createOperationId(),
          expectedRevision: category.revision,
          adminComment,
          publicComment,
        }),
      })
      const result = await readJsonResponse<{ revision: number }>(response)
      if (!result.ok) {
        if (handleConflict(result.status, result.body)) return
        throw new Error('Не удалось сохранить комментарий спортсмена')
      }
      if (result.data) {
        applyCategoryRevision(category.queueId, result.data.revision)
      }
      setPlacementDrafts((current) => ({
        ...current,
        [placementId]: { admin: adminComment, public: publicComment },
      }))
      setCommentsTarget(null)
      setMessage('Комментарий спортсмена сохранён')
      setMessageKind('success')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ошибка сохранения комментария')
      setMessageKind('error')
    } finally {
      setSaving(false)
    }
  }

  async function reorderCategory(
    queueId: string,
    action: 'moveUp' | 'moveDown' | 'moveToEnd' | 'moveToNormal',
  ) {
    if (!dashboard) return
    try {
      const response = await fetch(withBasePath('/api/admin/awards/queue'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId: createOperationId(),
          queueId,
          action,
          expectedQueueRevision: dashboard.queueRevision,
        }),
      })
      const result = await readJsonResponse(response)
      if (!result.ok) {
        if (handleConflict(result.status, result.body)) return
        throw new Error('Не удалось изменить порядок')
      }
      await loadDashboard()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ошибка перестановки')
      setMessageKind('error')
    }
  }

  async function bulkComplete(category: AwardCategory) {
    setSaving(true)
    try {
      const response = await fetch(withBasePath('/api/admin/awards/complete'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId: createOperationId(),
          queueId: category.queueId,
          expectedRevision: category.revision,
        }),
      })
      const result = await readJsonResponse<{ revision: number; queueRevision?: number }>(response)
      if (!result.ok) {
        if (handleConflict(result.status, result.body)) return
        throw new Error('Не удалось завершить категорию')
      }
      setBulkCompleteTarget(null)
      await loadDashboard()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ошибка завершения')
      setMessageKind('error')
    } finally {
      setSaving(false)
    }
  }

  async function requestAwardAnnouncerCall(
    category: AwardCategory,
    kind: 'category_call' | 'category_prepare' | 'placement',
    placementId?: string,
  ) {
    setSaving(true)
    try {
      const response = await fetch(withBasePath('/api/admin/awards/announcer-call'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueId: category.queueId,
          kind,
          placementId,
        }),
      })
      const result = await readJsonResponse<{
        eventId?: string
        alreadyQueued?: boolean
        error?: string
        code?: string
      }>(response)
      if (!result.ok) {
        throw new Error(result.data?.error ?? result.error ?? 'Не удалось добавить объявление')
      }
      setMessage(
        result.data?.alreadyQueued
          ? 'Это объявление уже в очереди информатора'
          : 'Объявление добавлено в очередь информатора',
      )
      setMessageKind('success')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ошибка вызова информатора')
      setMessageKind('error')
    } finally {
      setSaving(false)
    }
  }

  async function resolveReview(queueId: string) {
    try {
      const response = await fetch(withBasePath('/api/admin/awards/resolve-review'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId }),
      })
      const result = await readJsonResponse(response)
      if (!result.ok) throw new Error('Не удалось снять флаг проверки')
      await loadDashboard()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ошибка')
      setMessageKind('error')
    }
  }

  if (loading || !dashboard) {
    return <div className={adminBoutsPage}>Загрузка…</div>
  }

  const tabCategories =
    activeTab === 'queue'
      ? dashboard.queue
      : activeTab === 'completed'
        ? dashboard.completed
        : activeTab === 'review'
          ? dashboard.needsReview
          : []

  const commentsModalProps =
    commentsTarget?.kind === 'category'
      ? {
          title: 'Комментарии категории',
          subtitle: commentsTarget.category.categoryTitle,
          adminComment: categoryDrafts[commentsTarget.category.queueId]?.admin ?? '',
          publicComment: categoryDrafts[commentsTarget.category.queueId]?.public ?? '',
          onSave: (adminComment: string, publicComment: string) =>
            saveCategoryComments(commentsTarget.category, adminComment, publicComment),
        }
      : commentsTarget?.kind === 'placement'
        ? {
            title: 'Комментарии спортсмена',
            subtitle: commentsTarget.placement.displayName,
            adminComment: placementDrafts[commentsTarget.placement.id]?.admin ?? '',
            publicComment: placementDrafts[commentsTarget.placement.id]?.public ?? '',
            onSave: (adminComment: string, publicComment: string) =>
              savePlacementComment(
                commentsTarget.category,
                commentsTarget.placement.id,
                adminComment,
                publicComment,
              ),
          }
        : null

  return (
    <div className={adminBoutsPage}>
      <AdminPageHeader
        title="Награждение"
        description="Очередь церемоний и выдача медалей."
        actions={
          <Link href={withBasePath(routes.awards)} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" className={`${adminPageActionsBtn} gap-2`}>
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Публичная страница
            </Button>
          </Link>
        }
      />

      {message ? (
        <div
          className={cn(
            'animate-ui-stagger-in',
            messageKind === 'success' ? semanticAlertClasses.success : semanticAlertClasses.danger,
          )}
        >
          {message}
        </div>
      ) : null}

      <AdminAwardsControlsPanel
        publicEnabled={dashboard.settings.publicEnabled}
        ceremonyStartTime={dashboard.settings.ceremonyStartTime}
        ceremonyDurationMinutes={dashboard.settings.ceremonyDurationMinutes}
        ceremonyBreakMinutes={dashboard.settings.ceremonyBreakMinutes}
        saving={saving}
        onSavePublicEnabled={savePublicEnabled}
        onSaveTiming={saveTiming}
      />

      <div className={awardsAdminTabs}>
        {[
          ['queue', 'Очередь'],
          ['completed', 'Награждённые'],
          ['remaining', 'Остатки'],
          ['review', 'Проверка'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={awardsAdminTab(activeTab === id)}
            onClick={() => setActiveTab(id as typeof activeTab)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'remaining' ? (
        <section className={cn(awardsAdminCategoryCard, 'mt-3')}>
          <div className={awardsAdminCategoryHead}>
            <div>
              <h3 className={awardsAdminCategoryTitle}>Не вручено</h3>
              <p className={awardsAdminCategoryMeta}>
                🥇 {dashboard.remainingMedals.summary.gold} · 🥈{' '}
                {dashboard.remainingMedals.summary.silver} · 🥉{' '}
                {dashboard.remainingMedals.summary.bronze}
              </p>
            </div>
          </div>
          <ul>
            {dashboard.remainingMedals.items.map((item) => (
              <li key={item.placementId} className={awardsAdminRemainingItem}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    <span className={awardsMedalBadge(item.medal === '🥇' ? 1 : item.medal === '🥈' ? 2 : 3)}>
                      {item.medal}
                    </span>
                    <span className="ml-1.5">{item.displayName}</span>
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{item.categoryTitle} · {item.clubName}</span>
                    <ViewBracketCategoryButton
                      categoryKey={item.categoryKey}
                      categoryTitle={item.categoryTitle}
                      variant="admin"
                    />
                  </div>
                  {item.comment ? (
                    <p className="mt-0.5 text-xs text-muted">{item.comment}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary"
                    className="min-h-7 px-2 text-xs"
                    disabled={saving}
                    onClick={() => {
                      const category = dashboard.completed.find((row) => row.queueId === item.queueId)
                      if (!category) return
                      void requestAwardAnnouncerCall(category, 'placement', item.placementId)
                    }}
                  >
                    Вызов
                  </Button>
                  <Button
                    className="min-h-7 px-2.5 text-sm"
                    onClick={() => {
                      const category = dashboard.completed.find((row) => row.queueId === item.queueId)
                      if (!category) return
                      void updatePlacement(category, item.placementId, 'AWARDED')
                    }}
                  >
                    Выдать
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="mt-3 space-y-2">
          {tabCategories.map((category, index) => {
            const resolved = resolvedCount(category)
            const total = category.placements.length
            const progress = total > 0 ? (resolved / total) * 100 : 0
            const hasCategoryComments = Boolean(category.adminComment || category.publicComment)

            return (
              <section
                key={category.queueId}
                className={cn(
                  awardsAdminCategoryCard,
                  !entranceDone.current && 'animate-ui-stagger-in',
                )}
                style={entranceDone.current ? undefined : { animationDelay: `${index * 40}ms` }}
              >
                <div className={awardsAdminCategoryHead}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className={awardsAdminCategoryTitle}>{category.categoryTitle}</h3>
                      <ViewBracketCategoryButton
                        categoryKey={category.categoryKey}
                        categoryTitle={category.categoryTitle}
                        variant="admin"
                      />
                      <button
                        type="button"
                        className={cn(
                          awardsAdminIconBtn,
                          hasCategoryComments && awardsAdminIconBtnActive,
                        )}
                        onClick={() => setCommentsTarget({ kind: 'category', category })}
                        aria-label="Комментарии категории"
                        title="Комментарии категории"
                      >
                        <MessageSquare className="size-3.5" />
                      </button>
                    </div>
                    <p className={awardsAdminCategoryMeta}>
                      <span>{awardsCategoryStatusLabel(category.status)}</span>
                      <span>·</span>
                      <span>{category.estimatedTimeLabel}</span>
                      {total > 0 ? (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1.5">
                            {resolved}/{total}
                            <span className={awardsAdminProgressTrack}>
                              <span
                                className={awardsAdminProgressFill}
                                style={{ width: `${progress}%` }}
                              />
                            </span>
                          </span>
                        </>
                      ) : null}
                      {category.needsReview ? (
                        <>
                          <span>·</span>
                          <span className="text-amber-700">проверка</span>
                        </>
                      ) : null}
                    </p>
                    {category.conflictReason ? (
                      <p className="mt-0.5 text-xs text-amber-700">{category.conflictReason}</p>
                    ) : null}
                  </div>

                  <div className={awardsAdminCategoryActions}>
                    {activeTab === 'queue' &&
                    (category.status === 'PENDING' || category.status === 'IN_PROGRESS') ? (
                      <>
                        <Button
                          variant="secondary"
                          className="min-h-7 px-2 text-xs"
                          disabled={saving}
                          onClick={() => requestAwardAnnouncerCall(category, 'category_call')}
                        >
                          Пригласить
                        </Button>
                        <Button
                          variant="secondary"
                          className="min-h-7 px-2 text-xs"
                          disabled={saving}
                          onClick={() => requestAwardAnnouncerCall(category, 'category_prepare')}
                        >
                          Подготовка
                        </Button>
                        <button
                          type="button"
                          className={cn(adminCompactActionBtn, 'inline-flex min-w-7 items-center justify-center text-sm')}
                          onClick={() => reorderCategory(category.queueId, 'moveUp')}
                          aria-label="Выше"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={cn(adminCompactActionBtn, 'inline-flex min-w-7 items-center justify-center text-sm')}
                          onClick={() => reorderCategory(category.queueId, 'moveDown')}
                          aria-label="Ниже"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className={cn(adminCompactActionBtn, 'inline-flex items-center px-2 text-sm')}
                          onClick={() => reorderCategory(category.queueId, 'moveToEnd')}
                        >
                          В конец
                        </button>
                        {category.queueGroup === 'DEFERRED' ? (
                          <button
                            type="button"
                            className={cn(adminCompactActionBtn, 'inline-flex items-center px-2 text-sm')}
                            onClick={() => reorderCategory(category.queueId, 'moveToNormal')}
                          >
                            В очередь
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={cn(awardsAdminActionBtn, awardsAdminActionAward)}
                          onClick={() => setBulkCompleteTarget(category)}
                          disabled={saving}
                          aria-label="Подтвердить категорию"
                          title="Подтвердить категорию"
                        >
                          <Check className="size-3.5" strokeWidth={2.5} />
                        </button>
                      </>
                    ) : null}
                    {activeTab === 'review' ? (
                      <Button className="min-h-7 px-2 text-sm" onClick={() => resolveReview(category.queueId)}>
                        Снять флаг
                      </Button>
                    ) : null}
                  </div>
                </div>

                <ul className={awardsAdminPlacements}>
                  {category.placements.map((placement) => (
                    <AdminAwardPlacementRow
                      key={placement.id}
                      placement={placement}
                      animation={animating[placement.id]}
                      hasComments={Boolean(
                        placement.adminComment ||
                          placement.publicComment ||
                          placementDrafts[placement.id]?.admin ||
                          placementDrafts[placement.id]?.public,
                      )}
                      onOpenComments={() =>
                        setCommentsTarget({ kind: 'placement', category, placement })
                      }
                      onAnnouncerCall={
                        activeTab === 'queue' ||
                        activeTab === 'remaining' ||
                        category.status === 'IN_PROGRESS'
                          ? () =>
                              requestAwardAnnouncerCall(category, 'placement', placement.id)
                          : undefined
                      }
                      announcerCallDisabled={saving}
                      onAward={() => updatePlacement(category, placement.id, 'AWARDED')}
                      onSkip={
                        placement.status === 'PENDING'
                          ? () => updatePlacement(category, placement.id, 'NOT_AWARDED')
                          : undefined
                      }
                      onUndo={
                        placement.status !== 'PENDING'
                          ? () => updatePlacement(category, placement.id, 'PENDING')
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <AwardsCommentsModal
        open={commentsModalProps != null}
        title={commentsModalProps?.title ?? ''}
        subtitle={commentsModalProps?.subtitle}
        adminComment={commentsModalProps?.adminComment ?? ''}
        publicComment={commentsModalProps?.publicComment ?? ''}
        saving={saving}
        onClose={() => setCommentsTarget(null)}
        onSave={commentsModalProps?.onSave ?? (() => undefined)}
      />

      <AwardsBulkCompleteConfirmModal
        open={bulkCompleteTarget != null}
        categoryTitle={bulkCompleteTarget?.categoryTitle ?? ''}
        pendingCount={
          bulkCompleteTarget
            ? bulkCompleteTarget.placements.filter((placement) => placement.status === 'PENDING').length
            : 0
        }
        busy={saving}
        onCancel={() => {
          if (!saving) setBulkCompleteTarget(null)
        }}
        onConfirm={() => {
          if (bulkCompleteTarget) void bulkComplete(bulkCompleteTarget)
        }}
      />
    </div>
  )
}
