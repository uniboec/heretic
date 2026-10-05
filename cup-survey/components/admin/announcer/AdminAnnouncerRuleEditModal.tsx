'use client'

import type { AnnouncerRule } from '@prisma/client'
import { EVENT_TYPE_LABELS } from '@/lib/announcer/types'
import { ANNOUNCER_RULE_ALL_TOGGLES } from '@/lib/announcer/ruleDisplay'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import {
  announcerRuleToggle,
  announcerRuleToggleGrid,
  announcerSectionTitle,
} from '@/lib/ui/announcerUiClasses'
import { AnnouncerVoicePicker } from './AnnouncerVoicePicker'
import type { ProviderInfo } from '@/lib/announcer/voiceDisplay'
import type { CueSoundDefinition } from '@/lib/announcer/cueCatalog'

export function AdminAnnouncerRuleEditModal({
  open,
  rule,
  providers,
  cueSounds,
  onClose,
  onPatchRule,
}: {
  open: boolean
  rule: AnnouncerRule | null
  providers: ProviderInfo[]
  cueSounds: CueSoundDefinition[]
  onClose: () => void
  onPatchRule: (eventType: string, patch: Record<string, unknown>) => Promise<void>
}) {
  if (!rule) return null

  const eventLabel = EVENT_TYPE_LABELS[rule.eventType]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      panelClassName="max-w-2xl"
      ariaLabelledBy="announcer-rule-edit-title"
    >
      <div className="max-h-[min(85vh,44rem)] overflow-y-auto p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div className="min-w-0">
            <h2 id="announcer-rule-edit-title" className="text-base font-semibold text-foreground">
              {eventLabel}
            </h2>
            <p className="mt-1 text-xs text-muted">
              Приоритет {rule.priority} · изменения сохраняются автоматически
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className={announcerSectionTitle}>Голос</h3>
            <div className="mt-2">
              <AnnouncerVoicePicker
                modeName={`voice-mode-${rule.eventType}`}
                providers={providers}
                value={{ ttsProvider: rule.ttsProvider, ttsVoiceId: rule.ttsVoiceId }}
                onChange={(value) =>
                  void onPatchRule(rule.eventType, {
                    ttsProvider: value.ttsProvider,
                    ttsVoiceId: value.ttsVoiceId,
                  })
                }
              />
            </div>
          </div>

          {rule.includeCueSound ? (
            <Select
              label="Звуковой сигнал"
              value={rule.cueSoundId ?? ''}
              onChange={(event) =>
                void onPatchRule(rule.eventType, {
                  cueSoundId: event.target.value ? event.target.value : null,
                })
              }
            >
              <option value="">По умолчанию (из «Сигналы и паузы»)</option>
              {cueSounds
                .filter((sound) => sound.id !== 'none')
                .map((sound) => (
                  <option key={sound.id} value={sound.id}>{sound.label}</option>
                ))}
            </Select>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Формат ФИО"
              value={rule.nameFormat}
              onChange={(event) =>
                void onPatchRule(rule.eventType, { nameFormat: event.target.value })
              }
            >
              <option value="LAST_FIRST">Фамилия Имя</option>
              <option value="LAST_FIRST_MIDDLE">Фамилия Имя Отчество</option>
            </Select>
            <Input
              label="TTL (сек)"
              type="number"
              value={rule.ttlSeconds}
              onChange={(event) =>
                void onPatchRule(rule.eventType, { ttlSeconds: Number(event.target.value) })
              }
            />
          </div>

          <div>
            <h3 className={announcerSectionTitle}>Состав объявления</h3>
            <div className={announcerRuleToggleGrid}>
              {ANNOUNCER_RULE_ALL_TOGGLES.map(([key, label]) => (
                <label key={key} className={announcerRuleToggle}>
                  <input
                    type="checkbox"
                    checked={Boolean(rule[key])}
                    onChange={(event) =>
                      void onPatchRule(rule.eventType, { [key]: event.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
