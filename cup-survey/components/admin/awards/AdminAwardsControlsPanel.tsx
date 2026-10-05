'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AdminLocalTimeInput } from '@/components/admin/AdminLocalTimeInput'
import { AdminInputWithUnit } from '@/components/admin/AdminInputWithUnit'
import { useSyncedDraft } from '@/components/admin/bouts/useSyncedDraft'
import {
  adminBoutsSettingsBody,
  adminBoutsSettingsFieldGrid,
  adminBoutsSettingsSection,
  adminBoutsSettingsSectionHead,
  adminBoutsSettingsSectionTitle,
  adminPanel,
  adminPanelHeader,
  adminSettingsCheckbox,
} from '@/lib/ui/adminSurfaceStyles'

interface AdminAwardsControlsPanelProps {
  publicEnabled: boolean
  ceremonyStartTime: string
  ceremonyDurationMinutes: number
  ceremonyBreakMinutes: number
  saving: boolean
  onSavePublicEnabled: (value: boolean) => void | Promise<void>
  onSaveTiming: (patch: {
    ceremonyStartTime: string
    ceremonyDurationMinutes: number
    ceremonyBreakMinutes: number
  }) => Promise<boolean>
}

export function AdminAwardsControlsPanel({
  publicEnabled,
  ceremonyStartTime,
  ceremonyDurationMinutes,
  ceremonyBreakMinutes,
  saving,
  onSavePublicEnabled,
  onSaveTiming,
}: AdminAwardsControlsPanelProps) {
  const timingServer = useMemo(
    () => ({
      ceremonyStartTime,
      ceremonyDurationMinutes,
      ceremonyBreakMinutes,
    }),
    [ceremonyStartTime, ceremonyDurationMinutes, ceremonyBreakMinutes],
  )
  const {
    draft: timingDraft,
    updateDraft: setTimingDraft,
    isDirty: timingDirty,
    acceptServerValue: acceptTiming,
  } = useSyncedDraft(timingServer)

  async function saveTiming() {
    const ok = await onSaveTiming(timingDraft)
    if (ok) {
      acceptTiming(timingDraft)
    }
  }

  return (
    <section className={adminPanel}>
      <div className={adminPanelHeader}>
        <h2 className="text-sm font-semibold text-foreground">Настройки награждения</h2>
      </div>
      <div className={`${adminBoutsSettingsBody} gap-5`}>
        <div className={adminBoutsSettingsSection}>
          <div className={adminBoutsSettingsSectionHead}>
            <h3 className={adminBoutsSettingsSectionTitle}>Публикация</h3>
          </div>
          <label className={adminSettingsCheckbox}>
            <Input
              controlOnly
              type="checkbox"
              className="w-auto min-h-0 shrink-0 border-0 bg-transparent p-0 shadow-none"
              checked={publicEnabled}
              disabled={saving}
              onChange={(event) => onSavePublicEnabled(event.target.checked)}
            />
            <span>Публичная страница «Награждение»</span>
          </label>
        </div>

        <div className={adminBoutsSettingsSection}>
          <div className={adminBoutsSettingsSectionHead}>
            <h3 className={adminBoutsSettingsSectionTitle}>Расписание</h3>
          </div>
          <div className={adminBoutsSettingsFieldGrid}>
            <AdminLocalTimeInput
              label="Время старта"
              value={timingDraft.ceremonyStartTime}
              disabled={saving}
              onChange={(value) => setTimingDraft((current) => ({ ...current, ceremonyStartTime: value }))}
            />
            <AdminInputWithUnit
              label="Длительность категории"
              unit="мин"
              type="number"
              min={1}
              value={String(timingDraft.ceremonyDurationMinutes)}
              disabled={saving}
              onChange={(event) =>
                setTimingDraft((current) => ({
                  ...current,
                  ceremonyDurationMinutes: Number(event.target.value) || 1,
                }))
              }
            />
            <AdminInputWithUnit
              label="Пауза между категориями"
              unit="мин"
              type="number"
              min={0}
              value={String(timingDraft.ceremonyBreakMinutes)}
              disabled={saving}
              onChange={(event) =>
                setTimingDraft((current) => ({
                  ...current,
                  ceremonyBreakMinutes: Number(event.target.value) || 0,
                }))
              }
            />
          </div>
          {timingDirty ? (
            <div className="mt-4">
              <Button type="button" disabled={saving} onClick={() => void saveTiming()}>
                Сохранить расписание
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
