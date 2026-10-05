'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type { NormQualificationSettings } from '@/lib/rankQualifications/settings'
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
import { AdminPageHeader } from './AdminPageHeader'

type SettingsResponse = {
  settings: NormQualificationSettings
}

export function AdminNormQualificationSettingsPanel() {
  const [settings, setSettings] = useState<NormQualificationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const settingsResult = await readJsonResponse<SettingsResponse>(
        await fetch(withBasePath('/api/admin/norm-qualifications/settings')),
      )

      if (!settingsResult.ok) {
        setLoadError('Не удалось загрузить настройки нормативов ЕВСК.')
        return
      }

      setSettings(settingsResult.data.settings)
    } catch {
      setLoadError('Не удалось загрузить настройки нормативов ЕВСК.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const savePublicEnabled = async (publicEnabled: boolean) => {
    setSaving(true)
    setErrors([])
    setSuccess('')
    try {
      const response = await fetch(withBasePath('/api/admin/norm-qualifications/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicEnabled }),
      })
      const result = await readJsonResponse<SettingsResponse>(response)
      if (!result.ok) {
        setErrors(['Не удалось сохранить настройки нормативов.'])
        return
      }
      setSettings(result.data.settings)
      setSuccess(
        publicEnabled
          ? 'Публичная страница нормативов включена.'
          : 'Публичная страница нормативов скрыта.',
      )
    } catch {
      setErrors(['Не удалось сохранить настройки нормативов.'])
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Загрузка настроек нормативов ЕВСК…</p>
  }

  if (loadError || !settings) {
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
        title="Выполнение нормативов ЕВСК"
        description="Публичная страница с результатами выполнения нормативов по итогам турнира."
      />

      <section className={adminPanel}>
        <div className={adminPanelHeader}>
          <div>
            <p className={adminSettingsPanelTitle}>Публикация на сайте</p>
            <p className={adminSettingsPanelDesc}>
              Раздел «Нормативы» появляется в меню, когда публикация включена и есть данные
              расчёта.
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
          <Button
            type="button"
            variant={settings.publicEnabled ? 'secondary' : 'primary'}
            disabled={saving}
            onClick={() => void savePublicEnabled(!settings.publicEnabled)}
          >
            {settings.publicEnabled ? 'Скрыть публичную страницу' : 'Включить публичную страницу'}
          </Button>
        </div>
      </section>
    </section>
  )
}
