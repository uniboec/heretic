'use client'

import { adminPanel } from '@/lib/ui/adminSurfaceStyles'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BRACKET_SETTINGS_ACTION_LABELS } from '@/lib/brackets/labels'

interface AdminBracketSettingsPanelProps {
  settingsDraft: {
    publicEnabled: boolean
    includePaid: boolean
    includeUnpaid: boolean
  }
  busy: boolean
  hasDraft: boolean
  onSettingsChange: (
    updater: (current: AdminBracketSettingsPanelProps['settingsDraft']) =>
      AdminBracketSettingsPanelProps['settingsDraft'],
  ) => void
  onSavePublicSetting: () => void
  onSaveEligibilitySettings: () => void
}

export function AdminBracketSettingsPanel({
  settingsDraft,
  busy,
  hasDraft,
  onSettingsChange,
  onSavePublicSetting,
  onSaveEligibilitySettings,
}: AdminBracketSettingsPanelProps) {
  return (
    <div className={`${adminPanel} space-y-4 p-4`}>
      <label className="flex items-center gap-2 text-sm">
        <Input
          controlOnly
          type="checkbox"
          className="w-auto min-h-0 shrink-0 border-0 bg-transparent p-0 shadow-none"
          checked={settingsDraft.publicEnabled}
          onChange={(event) =>
            onSettingsChange((current) => ({ ...current, publicEnabled: event.target.checked }))
          }
        />
        Публичная страница «Сетки» включена
      </label>
      <Button onClick={onSavePublicSetting} disabled={busy}>
        {BRACKET_SETTINGS_ACTION_LABELS.save}
      </Button>

      <hr className="border-border" />

      <label className="flex items-center gap-2 text-sm">
        <Input
          controlOnly
          type="checkbox"
          className="w-auto min-h-0 shrink-0 border-0 bg-transparent p-0 shadow-none"
          checked={settingsDraft.includePaid}
          onChange={(event) =>
            onSettingsChange((current) => ({ ...current, includePaid: event.target.checked }))
          }
        />
        Включать оплаченных
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Input
          controlOnly
          type="checkbox"
          className="w-auto min-h-0 shrink-0 border-0 bg-transparent p-0 shadow-none"
          checked={settingsDraft.includeUnpaid}
          onChange={(event) =>
            onSettingsChange((current) => ({ ...current, includeUnpaid: event.target.checked }))
          }
        />
        Включать неоплаченных
      </label>
      <p className="text-xs text-muted">Изменение критериев требует синхронизации заявок.</p>
      <Button onClick={onSaveEligibilitySettings} disabled={busy || !hasDraft}>
        {BRACKET_SETTINGS_ACTION_LABELS.saveEligibility}
      </Button>
    </div>
  )
}
