'use client'

import { useMemo, useState } from 'react'
import type { AnnouncerRule } from '@prisma/client'
import { GripVertical, Settings2 } from 'lucide-react'
import { EVENT_TYPE_LABELS } from '@/lib/announcer/types'
import {
  formatAnnouncerRuleCueSummary,
  formatAnnouncerRuleIncludeSummary,
  formatAnnouncerRuleNameFormat,
  formatAnnouncerRuleVoiceSummary,
} from '@/lib/announcer/ruleDisplay'
import { Button } from '@/components/ui/Button'
import { adminCompactActionBtn } from '@/lib/ui/adminSurfaceStyles'
import {
  announcerEventStatusMuted,
  announcerEventStatusReady,
  announcerEventStatusBadge,
  announcerRuleCard,
  announcerRuleCardDragging,
  announcerRuleListMeta,
  announcerRuleListSummary,
} from '@/lib/ui/announcerUiClasses'
import { cn } from '@/lib/cn'
import { AnnouncerPanel } from './AnnouncerPanel'
import { AdminAnnouncerRuleEditModal } from './AdminAnnouncerRuleEditModal'
import { useAnnouncerProviders } from './useAnnouncerProviders'
import { useCueSoundCatalog } from './useCueSoundCatalog'

export function AdminAnnouncerRulesPanel(input: {
  rules: AnnouncerRule[]
  onPatchRule: (eventType: string, patch: Record<string, unknown>) => Promise<void>
  onReorder: (orderedEventTypes: string[]) => Promise<void>
}) {
  const providers = useAnnouncerProviders()
  const { catalog: cueSounds } = useCueSoundCatalog()
  const [dragging, setDragging] = useState<string | null>(null)
  const [editingEventType, setEditingEventType] = useState<AnnouncerRule['eventType'] | null>(null)

  const sortedRules = useMemo(
    () => [...input.rules].sort((a, b) => b.priority - a.priority),
    [input.rules],
  )

  const editingRule = editingEventType
    ? sortedRules.find((rule) => rule.eventType === editingEventType) ?? null
    : null

  const move = async (eventType: string, direction: 'up' | 'down') => {
    const order = sortedRules.map((rule) => rule.eventType)
    const index = order.indexOf(eventType as AnnouncerRule['eventType'])
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || swapIndex < 0 || swapIndex >= order.length) return
    const next = [...order]
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
    await input.onReorder(next)
  }

  const onDrop = async (targetType: string) => {
    if (!dragging || dragging === targetType) return
    const order = sortedRules.map((rule) => rule.eventType)
    const from = order.indexOf(dragging as AnnouncerRule['eventType'])
    const to = order.indexOf(targetType as AnnouncerRule['eventType'])
    if (from < 0 || to < 0) return
    const next = [...order]
    next.splice(from, 1)
    next.splice(to, 0, dragging as AnnouncerRule['eventType'])
    setDragging(null)
    await input.onReorder(next)
  }

  return (
    <>
      <AnnouncerPanel
        title="События и приоритеты"
        description="Сверху вниз — от более важных к менее важным. Нажмите «Настроить», чтобы изменить голос и состав объявления."
      >
        <div className="space-y-2">
          {sortedRules.map((rule) => {
            const cueSummary = formatAnnouncerRuleCueSummary(rule, cueSounds)
            const includeSummary = formatAnnouncerRuleIncludeSummary(rule)

            return (
              <div
                key={rule.id}
                draggable
                onDragStart={() => setDragging(rule.eventType)}
                onDragEnd={() => setDragging(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void onDrop(rule.eventType)}
                className={cn(
                  announcerRuleCard,
                  'p-3 sm:p-3.5',
                  dragging === rule.eventType && announcerRuleCardDragging,
                )}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <span
                    className="mt-0.5 shrink-0 cursor-grab text-muted active:cursor-grabbing"
                    aria-hidden="true"
                  >
                    <GripVertical className="size-4" strokeWidth={1.75} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-foreground">
                        {EVENT_TYPE_LABELS[rule.eventType]}
                      </div>
                      <span
                        className={cn(
                          announcerEventStatusBadge,
                          rule.enabled ? announcerEventStatusReady : announcerEventStatusMuted,
                        )}
                      >
                        {rule.enabled ? 'Вкл' : 'Выкл'}
                      </span>
                    </div>

                    <p className={announcerRuleListMeta}>
                      Приоритет {rule.priority} · TTL {rule.ttlSeconds} с ·{' '}
                      {formatAnnouncerRuleNameFormat(rule)}
                    </p>

                    <p className={announcerRuleListMeta}>
                      {formatAnnouncerRuleVoiceSummary(rule, providers)}
                    </p>

                    <div className={announcerRuleListSummary}>
                      <span className="rounded-full border border-border bg-background-soft px-2 py-0.5 text-[0.6875rem] font-medium text-muted">
                        {includeSummary}
                      </span>
                      {cueSummary ? (
                        <span className="rounded-full border border-border bg-background-soft px-2 py-0.5 text-[0.6875rem] font-medium text-muted">
                          {cueSummary}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
                    <div className="flex gap-1">
                      <Button
                        variant="secondary"
                        className={adminCompactActionBtn}
                        onClick={() => void move(rule.eventType, 'up')}
                        aria-label="Выше в приоритете"
                      >
                        ↑
                      </Button>
                      <Button
                        variant="secondary"
                        className={adminCompactActionBtn}
                        onClick={() => void move(rule.eventType, 'down')}
                        aria-label="Ниже в приоритете"
                      >
                        ↓
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className={adminCompactActionBtn}
                      onClick={() => setEditingEventType(rule.eventType)}
                    >
                      <Settings2 className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                      <span className="ml-1.5">Настроить</span>
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </AnnouncerPanel>

      <AdminAnnouncerRuleEditModal
        open={editingEventType !== null}
        rule={editingRule}
        providers={providers}
        cueSounds={cueSounds}
        onClose={() => setEditingEventType(null)}
        onPatchRule={input.onPatchRule}
      />
    </>
  )
}
