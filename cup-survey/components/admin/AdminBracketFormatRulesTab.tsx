'use client'

import { adminPanel, adminPanelHeader, adminCards, adminTableDesktop, adminTableWrap, adminRowCard, adminCardFields, adminCardField, adminSegmentTab, adminBracketsTabs, adminBracketsToolbar, adminBracketsToolbarGroup, adminBracketsToolbarLabel } from '@/lib/ui/adminSurfaceStyles'
import { useCallback, useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table } from '@/components/ui/Table'
import { BRACKET_FORMAT_RULES_ACTION_LABELS } from '@/lib/brackets/labels'
import {
  getCompatibleSystemIdsForRuleRange,
  isBronzeModeConfigurableForFormatRule,
  isSystemCompatibleWithRuleRange,
} from '@/lib/brackets/core/formatRules'
import {
  bracketAdminFetch,
  formatAllowedSystemIds,
  formatBronzeModeLabel,
  formatFormatRuleLabel,
  formatSystemLabel,
} from './brackets/bracketAdminUtils'
import {
  createDefaultFormatRuleRow,
  defaultSystemForRuleRange,
} from '@/lib/brackets/defaultFormatRules'
import { formatBracketWarnings } from './brackets/bracketWarningLabels'

export interface FormatRuleRow {
  id: string
  minParticipants: number
  maxParticipants: number
  systemId: string
  defaultBronzeMode: 'ONE' | 'TWO' | null
  allowedSystemIds: string[]
  sortOrder: number
  enabled: boolean
}

const ALLOWED_SYSTEM_OPTIONS = [
  { id: 'champion', label: formatSystemLabel('champion') },
  { id: 'olympic', label: formatSystemLabel('olympic') },
  { id: 'round_robin', label: formatSystemLabel('round_robin') },
  { id: 'three_way', label: formatSystemLabel('three_way') },
] as const

function normalizeRuleSystems(rule: FormatRuleRow): FormatRuleRow {
  const compatible = getCompatibleSystemIdsForRuleRange(
    rule.minParticipants,
    rule.maxParticipants,
  )
  const fallbackSystem = defaultSystemForRuleRange(rule.minParticipants, rule.maxParticipants)
  const allowedSystemIds = rule.allowedSystemIds.filter((id) => compatible.includes(id))
  const nextAllowed =
    allowedSystemIds.length > 0 ? allowedSystemIds : compatible.length > 0 ? [compatible[0]] : [fallbackSystem]
  const systemId = compatible.includes(rule.systemId)
    ? rule.systemId
    : nextAllowed[0] ?? fallbackSystem
  const defaultBronzeMode = isBronzeModeConfigurableForFormatRule(systemId, rule.maxParticipants)
    ? rule.defaultBronzeMode
    : null
  return { ...rule, allowedSystemIds: nextAllowed, systemId, defaultBronzeMode }
}

interface AdminBracketFormatRulesTabProps {
  draftId: string | null
  draftVersion: number | null
  onSaved: () => void
  onDraftChange?: (draft: { id: string; version: number }) => void
  onWarnings?: (warnings: string[]) => void
  onToast?: (message: string, type?: 'error' | 'success') => void
}

export function AdminBracketFormatRulesTab({
  draftId,
  draftVersion,
  onSaved,
  onDraftChange,
  onWarnings,
  onToast,
}: AdminBracketFormatRulesTabProps) {
  const [rules, setRules] = useState<FormatRuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(withBasePath('/api/admin/brackets/format-rules'))
      const result = await readJsonResponse<{ rules?: FormatRuleRow[] }>(res)
      setRules(result.ok ? (result.data.rules ?? []) : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggleAllowedSystem = (index: number, systemId: string) => {
    setRules((prev) =>
      prev.map((rule, ruleIndex) => {
        if (ruleIndex !== index) return rule
        const hasSystem = rule.allowedSystemIds.includes(systemId)
        const nextAllowed = hasSystem
          ? rule.allowedSystemIds.filter((id) => id !== systemId)
          : [...rule.allowedSystemIds, systemId]
        return {
          ...rule,
          allowedSystemIds: nextAllowed.length > 0 ? nextAllowed : [systemId],
        }
      }),
    )
  }

  const save = async () => {
    if (!draftId || draftVersion == null) {
      onToast?.('Черновик сеток не найден', 'error')
      return
    }
    setSaving(true)
    try {
      const result = await bracketAdminFetch<{
        draft: { id: string; version: number }
        warnings?: Array<{ code: string; categoryKey?: string; n?: number }>
      }>('/api/admin/brackets/format-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules, draftId, expectedVersion: draftVersion }),
      })
      if (!result.ok) {
        onToast?.(result.message, 'error')
        return
      }
      onDraftChange?.(result.data.draft)
      onWarnings?.(formatBracketWarnings(result.data.warnings ?? []))
      onToast?.('Правила формата сохранены', 'success')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const updateRule = (index: number, patch: Partial<FormatRuleRow>) => {
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r
        const next = { ...r, ...patch }
        if ('minParticipants' in patch || 'maxParticipants' in patch || 'systemId' in patch) {
          return normalizeRuleSystems(next)
        }
        return next
      }),
    )
  }

  const addRule = () => {
    const maxOrder = rules.reduce((max, r) => Math.max(max, r.sortOrder), 0)
    setRules((prev) => [...prev, createDefaultFormatRuleRow(maxOrder + 1)])
  }

  const deleteRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index))
  }

  const moveRule = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= rules.length) return
    setRules((prev) => {
      const next = [...prev]
      const a = next[index]
      const b = next[target]
      next[index] = { ...b, sortOrder: a.sortOrder }
      next[target] = { ...a, sortOrder: b.sortOrder }
      next.sort((x, y) => x.sortOrder - y.sortOrder)
      return next
    })
  }

  const previewRules = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  if (loading) {
    return (
      <div className={`${adminPanel} p-6 text-sm text-muted`}>Загрузка правил формата…</div>
    )
  }

  return (
    <div className={`${adminPanel} space-y-4 p-4`}>
      <div>
        <h2 className="text-lg font-semibold">Правила формата</h2>
        <p className="mt-1 text-sm text-muted">
          Правила по числу участников. Изменения пересчитывают автоматическую систему проведения для
          категорий черновика.
        </p>
      </div>
      {previewRules.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
          <p className="mb-2 font-medium">Предпросмотр разрешённых систем:</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            {previewRules.map((rule) => (
              <li key={rule.id}>
                {rule.minParticipants}–{rule.maxParticipants} участников:{' '}
                <span className="text-foreground">
                  {formatFormatRuleLabel(rule.systemId, rule.defaultBronzeMode)}
                </span>
                {' · '}допустимо: {formatAllowedSystemIds(rule.allowedSystemIds)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-10 text-center text-sm text-muted">
          Правила формата ещё не заданы. Добавьте первое правило, чтобы система проведения
          подбиралась автоматически.
        </div>
      ) : (
      <div className={`${adminTableWrap} ${adminTableDesktop}`}>
        <Table className="w-full min-w-[52rem]">
          <thead>
            <tr>
              <th>Порядок</th>
              <th>Участников от</th>
              <th>Участников до</th>
              <th>Система</th>
              <th>Бронза</th>
              <th>Разрешённые</th>
              <th>Вкл.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => (
              <tr key={rule.id}>
                <td className="whitespace-nowrap">
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-1 text-muted hover:text-foreground disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => moveRule(index, -1)}
                    aria-label="Выше"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-1 text-muted hover:text-foreground disabled:opacity-30"
                    disabled={index === rules.length - 1}
                    onClick={() => moveRule(index, 1)}
                    aria-label="Ниже"
                  >
                    ↓
                  </Button>
                </td>
                <td>
                  <Input
                    controlOnly
                    density="compact"
                    size="sm"
                    type="number"
                    className="w-16"
                    value={rule.minParticipants}
                    onChange={(e) =>
                      updateRule(index, { minParticipants: Number(e.target.value) })
                    }
                  />
                </td>
                <td>
                  <Input
                    controlOnly
                    density="compact"
                    size="sm"
                    type="number"
                    className="w-16"
                    value={rule.maxParticipants}
                    onChange={(e) =>
                      updateRule(index, { maxParticipants: Number(e.target.value) })
                    }
                  />
                </td>
                <td>
                  <Select
                    controlOnly
                    density="compact"
                    value={rule.systemId}
                    onChange={(e) => updateRule(index, { systemId: e.target.value })}
                  >
                    {getCompatibleSystemIdsForRuleRange(
                      rule.minParticipants,
                      rule.maxParticipants,
                    ).map((systemId) => (
                      <option key={systemId} value={systemId}>
                        {formatSystemLabel(systemId)}
                      </option>
                    ))}
                  </Select>
                </td>
                <td>
                  {isBronzeModeConfigurableForFormatRule(rule.systemId, rule.maxParticipants) ? (
                    <Select
                      controlOnly
                      density="compact"
                      value={rule.defaultBronzeMode ?? ''}
                      onChange={(e) =>
                        updateRule(index, {
                          defaultBronzeMode: (e.target.value || null) as 'ONE' | 'TWO' | null,
                        })
                      }
                    >
                      <option value="">—</option>
                      <option value="ONE">{formatBronzeModeLabel('ONE')}</option>
                      <option value="TWO">{formatBronzeModeLabel('TWO')}</option>
                    </Select>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  <div className="flex min-w-[11rem] flex-col gap-1.5">
                    {ALLOWED_SYSTEM_OPTIONS.filter((option) =>
                      isSystemCompatibleWithRuleRange(
                        option.id,
                        rule.minParticipants,
                        rule.maxParticipants,
                      ),
                    ).map((option) => (
                      <label key={option.id} className="flex items-center gap-2 text-xs">
                        <Input
                          controlOnly
                          type="checkbox"
                          className="w-auto min-h-0 shrink-0 border-0 bg-transparent p-0 shadow-none"
                          checked={rule.allowedSystemIds.includes(option.id)}
                          onChange={() => toggleAllowedSystem(index, option.id)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </td>
                <td>
                  <Input
                    controlOnly
                    type="checkbox"
                    className="w-auto min-h-0 shrink-0 border-0 bg-transparent p-0 shadow-none"
                    checked={rule.enabled}
                    onChange={(e) => updateRule(index, { enabled: e.target.checked })}
                  />
                </td>
                <td>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs text-danger hover:underline"
                    onClick={() => deleteRule(index)}
                  >
                    Удалить
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={addRule}>
          {BRACKET_FORMAT_RULES_ACTION_LABELS.add}
        </Button>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Сохранение…' : BRACKET_FORMAT_RULES_ACTION_LABELS.save}
        </Button>
      </div>
    </div>
  )
}
