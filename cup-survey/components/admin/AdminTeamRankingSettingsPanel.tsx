'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import type { SoloParticipantPointsMode } from '@prisma/client'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type { TeamRankingPointSettings, TeamRankingSettings } from '@/lib/teamRankings/types'
import {
  adminPanel,
  adminPanelHeader,
  adminSettingsAlertError,
  adminSettingsAlertSuccess,
  adminSettingsLayout,
  adminSettingsPanelBody,
  adminSettingsPanelDesc,
  adminSettingsPanelTitle,
} from '@/lib/ui/adminSurfaceStyles'
import { Button } from '@/components/ui/Button'
import { AdminInput } from './AdminInput'
import { AdminPageHeader } from './AdminPageHeader'
import { AdminSelect } from './AdminSelect'

type SettingsResponse = {
  settings: TeamRankingSettings
  pointSettings: TeamRankingPointSettings
}

type DraftState = {
  firstPlacePoints: string
  secondPlacePoints: string
  thirdPlacePoints: string
  soloParticipantPointsMode: SoloParticipantPointsMode
  soloParticipantFirstPlacePoints: string
}

function toDraft(settings: TeamRankingSettings): DraftState {
  return {
    firstPlacePoints: String(settings.firstPlacePoints),
    secondPlacePoints: String(settings.secondPlacePoints),
    thirdPlacePoints: String(settings.thirdPlacePoints),
    soloParticipantPointsMode: settings.soloParticipantPointsMode,
    soloParticipantFirstPlacePoints:
      settings.soloParticipantFirstPlacePoints != null
        ? String(settings.soloParticipantFirstPlacePoints)
        : '',
  }
}

function parseNonNegativeInt(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export function AdminTeamRankingSettingsPanel() {
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await readJsonResponse<SettingsResponse>(
        await fetch(withBasePath('/api/admin/team-rankings/settings')),
      )
      if (!result.ok) {
        setLoadError('Не удалось загрузить настройки командного зачёта.')
        return
      }
      setDraft(toDraft(result.data.settings))
    } catch {
      setLoadError('Не удалось загрузить настройки командного зачёта.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!draft) return

    const firstPlacePoints = parseNonNegativeInt(draft.firstPlacePoints)
    const secondPlacePoints = parseNonNegativeInt(draft.secondPlacePoints)
    const thirdPlacePoints = parseNonNegativeInt(draft.thirdPlacePoints)
    const soloPoints =
      draft.soloParticipantPointsMode === 'CUSTOM'
        ? parseNonNegativeInt(draft.soloParticipantFirstPlacePoints)
        : null

    const nextErrors: string[] = []
    if (firstPlacePoints == null) nextErrors.push('Укажите корректные баллы за 1 место.')
    if (secondPlacePoints == null) nextErrors.push('Укажите корректные баллы за 2 место.')
    if (thirdPlacePoints == null) nextErrors.push('Укажите корректные баллы за 3 место.')
    if (draft.soloParticipantPointsMode === 'CUSTOM' && soloPoints == null) {
      nextErrors.push('Укажите корректные баллы для одиночных категорий.')
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      setSuccess('')
      return
    }

    setSaving(true)
    setErrors([])
    setSuccess('')
    try {
      const response = await fetch(withBasePath('/api/admin/team-rankings/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstPlacePoints,
          secondPlacePoints,
          thirdPlacePoints,
          soloParticipantPointsMode: draft.soloParticipantPointsMode,
          soloParticipantFirstPlacePoints: soloPoints,
        }),
      })
      const result = await readJsonResponse<SettingsResponse>(response)
      if (!result.ok) {
        setErrors(['Не удалось сохранить настройки командного зачёта.'])
        return
      }
      setDraft(toDraft(result.data.settings))
      setSuccess('Настройки командного зачёта сохранены.')
    } catch {
      setErrors(['Не удалось сохранить настройки командного зачёта.'])
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Загрузка настроек командного зачёта…</p>
  }

  if (loadError || !draft) {
    return (
      <div className={adminSettingsAlertError}>
        <p>{loadError ?? 'Не удалось загрузить настройки.'}</p>
        <Button className="mt-3" onClick={() => void load()}>
          Повторить
        </Button>
      </div>
    )
  }

  return (
    <section className={adminSettingsLayout}>
      <AdminPageHeader
        title="Командный зачёт"
        description="Баллы за призовые места спортсменов, которые суммируются по клубам на публичной странице «Команды»."
      />

      <section className={adminPanel}>
        <div className={adminPanelHeader}>
          <div>
            <p className={adminSettingsPanelTitle}>Баллы и одиночные категории</p>
            <p className={adminSettingsPanelDesc}>
              Настройки командного зачёта для текущего турнира.
            </p>
          </div>
        </div>

        {errors.length > 0 ? (
          <div className={cn(adminSettingsAlertError, 'mx-4 mt-4 sm:mx-5')}>
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}

        {success ? (
          <div className={cn(adminSettingsAlertSuccess, 'mx-4 mt-4 sm:mx-5')}>{success}</div>
        ) : null}

        <div className={adminSettingsPanelBody}>
        <div>
          <h3 className={adminSettingsPanelTitle}>Баллы за места</h3>
          <p className={adminSettingsPanelDesc}>Стандартное начисление за 1, 2 и 3 места в категории.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <AdminInput
            label="1 место"
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.firstPlacePoints}
            onChange={(event) =>
              setDraft((current) =>
                current ? { ...current, firstPlacePoints: event.target.value } : current,
              )
            }
          />
          <AdminInput
            label="2 место"
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.secondPlacePoints}
            onChange={(event) =>
              setDraft((current) =>
                current ? { ...current, secondPlacePoints: event.target.value } : current,
              )
            }
          />
          <AdminInput
            label="3 место"
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.thirdPlacePoints}
            onChange={(event) =>
              setDraft((current) =>
                current ? { ...current, thirdPlacePoints: event.target.value } : current,
              )
            }
          />
        </div>

        <div className="border-t border-border pt-4">
          <h3 className={adminSettingsPanelTitle}>Одиночные категории</h3>
          <p className={adminSettingsPanelDesc}>
            Категория с одним спортсменом без боёв. По умолчанию начисляется как обычное 1 место.
          </p>
        </div>

        <AdminSelect
          label="Режим начисления"
          value={draft.soloParticipantPointsMode}
          onChange={(event) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    soloParticipantPointsMode: event.target.value as SoloParticipantPointsMode,
                  }
                : current,
            )
          }
        >
          <option value="STANDARD">Как обычное 1 место</option>
          <option value="EXCLUDE">Не начислять баллы</option>
          <option value="CUSTOM">Своё количество баллов</option>
        </AdminSelect>

        {draft.soloParticipantPointsMode === 'CUSTOM' ? (
          <AdminInput
            label="Баллы за 1 место в одиночной категории"
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.soloParticipantFirstPlacePoints}
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? { ...current, soloParticipantFirstPlacePoints: event.target.value }
                  : current,
              )
            }
          />
        ) : null}

        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
        </div>
      </section>
    </section>
  )
}
