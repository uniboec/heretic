'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { getRegistrationPublicErrorMessage } from '@/lib/registration/publicErrorMessages'
import { getDeviceToken } from '@/lib/registration/deviceClient'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/cn'
import {
  registrationUnlockForm,
  registrationUnlockFormDescription,
  registrationUnlockFormEmbedded,
  registrationUnlockFormNumber,
  registrationUnlockFormTitle,
} from '@/lib/ui/eventSurfaceStyles'
import { EventInput } from './EventFormFields'

interface Props {
  editToken?: string
  entryId?: string
  publicNumber?: number
  onSuccess: () => void
  title?: string
  description?: string
  submitLabel?: string
  titleId?: string
  /** Если false, после успеха остаёмся на странице (например, обновляем список заявок). */
  redirectOnSuccess?: boolean
  embedded?: boolean
}

export function RegistrationUnlockForm({
  editToken,
  entryId,
  publicNumber,
  onSuccess,
  title,
  description,
  submitLabel,
  titleId,
  redirectOnSuccess = true,
  embedded = false,
}: Props) {
  const codeOnly = Boolean(editToken || entryId)
  const [contact, setContact] = useState('')
  const [editCode, setEditCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const resolvedTitle = title ?? (codeOnly ? 'Введите секретный код' : 'Найти заявку')
  const resolvedDescription =
    description ??
    (codeOnly
      ? 'Для редактирования заявки укажите секретный код, который вы задали при регистрации.'
      : 'Укажите телефон или почту из заявки и секретный код.')
  const resolvedSubmitLabel = submitLabel ?? (codeOnly ? 'Продолжить' : 'Найти заявку')

  const submit = async () => {
    setSubmitting(true)
    setError('')
    const deviceToken = getDeviceToken()

    const url = editToken
      ? withBasePath(`/api/registrations/edit/${editToken}/auth`)
      : entryId
        ? withBasePath(`/api/registrations/entries/${entryId}/auth`)
        : withBasePath('/api/registrations/unlock')

    if (!codeOnly && !contact.trim()) {
      setError('Укажите телефон или электронную почту')
      setSubmitting(false)
      return
    }

    const payload = codeOnly
      ? { editCode, deviceToken }
      : { contact, editCode, deviceToken }

    const result = await readJsonResponse<{ errors?: string[]; error?: string; editToken?: string }>(
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    )
    setSubmitting(false)

    if (!result.ok) {
      const body = result.body as { errors?: string[]; error?: string } | undefined
      setError(
        body?.errors?.[0] ??
          getRegistrationPublicErrorMessage(
            body?.error,
            codeOnly
              ? 'Неверный секретный код.'
              : 'Заявка не найдена. Проверьте телефон или почту и секретный код.',
          ),
      )
      return
    }

    if (!editToken && result.data.editToken && redirectOnSuccess) {
      window.location.href = withBasePath(routes.edit(result.data.editToken))
      return
    }

    onSuccess()
  }

  return (
    <div className={cn(embedded ? registrationUnlockFormEmbedded : registrationUnlockForm)}>
      <h2 id={titleId} className={registrationUnlockFormTitle}>{resolvedTitle}</h2>
      <p className={registrationUnlockFormDescription}>{resolvedDescription}</p>

      {publicNumber != null && (
        <p className={registrationUnlockFormNumber}>Регистрация № {publicNumber}</p>
      )}

      {!codeOnly && (
        <EventInput
          fieldClassName="mt-5"
          label="Телефон или электронная почта"
          type="text"
          autoComplete="username"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="+7 (900) 000-00-00 или example@mail.ru"
        />
      )}

      <EventInput
        fieldClassName="mt-4"
        label="Секретный код"
        type="password"
        autoComplete="off"
        value={editCode}
        onChange={(e) => setEditCode(e.target.value)}
        placeholder="Код, указанный при регистрации"
      />

      {error && <p className="mt-3 text-sm font-medium text-accent" role="alert">{error}</p>}

      <Button className="mt-5 min-h-11 w-full" onClick={submit} disabled={submitting || editCode.length < 4}>
        {submitting ? 'Проверка…' : resolvedSubmitLabel}
      </Button>
    </div>
  )
}
