'use client'

import { useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'
import {
  adminEditCodePanel,
  adminEditCodePanelAthlete,
  adminEditCodePanelForm,
  adminEditCodePanelHead,
  adminEditCodePanelLead,
  adminEditCodePanelMessage,
  adminEditCodePanelMessageError,
  adminEditCodePanelMessageSuccess,
  adminModalSectionTitle,
} from '@/lib/ui/adminSurfaceStyles'
import { AdminInput } from './AdminInput'

interface Props {
  registrationId: string
  hasEditCode: boolean
  description?: string
  variant?: 'default' | 'athlete'
  onUpdated?: () => void
}

export function AdminEditCodePanel({
  registrationId,
  hasEditCode,
  description,
  variant = 'default',
  onUpdated,
}: Props) {
  const [editCode, setEditCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [codeIsSet, setCodeIsSet] = useState(hasEditCode)

  useEffect(() => {
    setCodeIsSet(hasEditCode)
  }, [hasEditCode])

  useEffect(() => {
    if (!registrationId) return
    setEditCode('')
    setError('')
    setSuccess('')
  }, [registrationId])

  const save = async () => {
    if (editCode.trim().length < 4) {
      setError('Минимум 4 символа')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const result = await readJsonResponse<{ messages?: string[] }>(
        await fetch(withBasePath(`/api/admin/registrations/${registrationId}/edit-code`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ editCode }),
        }),
      )

      if (!result.ok) {
        const body = result.body as { messages?: string[] } | undefined
        setError(
          Array.isArray(body?.messages) && body.messages.length > 0
            ? body.messages.join(' ')
            : result.error,
        )
        return
      }

      setEditCode('')
      setCodeIsSet(true)
      setSuccess('Секретный код обновлён. Сообщите новый код тренеру.')
      onUpdated?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={cn(adminEditCodePanel, variant === 'athlete' && adminEditCodePanelAthlete)}>
      <div className={adminEditCodePanelHead}>
        <h3 className={adminModalSectionTitle}>Секретный код</h3>
        <StatusBadge tone={codeIsSet ? 'success' : 'warning'}>
          {codeIsSet ? 'Задан' : 'Не задан'}
        </StatusBadge>
      </div>
      <p className={adminEditCodePanelLead}>
        {description ??
          'Код нужен тренеру для редактирования заявки и доступа из раздела «Мои заявки». Хранится в зашифрованном виде — текущее значение показать нельзя.'}
      </p>
      <div className={adminEditCodePanelForm}>
        <AdminInput
          label="Новый секретный код"
          type="text"
          autoComplete="off"
          value={editCode}
          onChange={(event) => setEditCode(event.target.value)}
          placeholder="Минимум 4 символа"
        />
        <Button
          type="button"
          className="min-h-10 shrink-0"
          onClick={save}
          disabled={saving || editCode.trim().length < 4}
        >
          {saving ? 'Сохранение…' : codeIsSet ? 'Сменить код' : 'Задать код'}
        </Button>
      </div>
      {error && <p className={cn(adminEditCodePanelMessage, adminEditCodePanelMessageError)}>{error}</p>}
      {success && <p className={cn(adminEditCodePanelMessage, adminEditCodePanelMessageSuccess)}>{success}</p>}
    </section>
  )
}
