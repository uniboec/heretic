'use client'

import { useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import {
  adminModal,
  adminModalBody,
  adminModalClose,
  adminModalFooter,
  adminModalHead,
  adminModalTitle,
} from '@/lib/ui/adminSurfaceStyles'
import { AdminInput } from './AdminInput'

export interface AdminClubRow {
  id: string
  name: string
  city: string
  discountPercent: number | null
  registrationsCount: number
  athletesCount: number
  entriesCount: number
}

interface Props {
  open: boolean
  club: AdminClubRow | null
  onClose: () => void
  onSaved: (club: AdminClubRow) => void
}

export function AdminClubEditModal({ open, club, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [discountPercent, setDiscountPercent] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !club) {
      setName('')
      setCity('')
      setDiscountPercent('')
      setErrors([])
      return
    }

    setName(club.name)
    setCity(club.city)
    setDiscountPercent(club.discountPercent != null ? String(club.discountPercent) : '')
    setErrors([])
  }, [club, open])

  const save = async () => {
    if (!club) return

    setSaving(true)
    setErrors([])

    try {
      const result = await readJsonResponse<{ club?: AdminClubRow; error?: string; errors?: string[] }>(
        await fetch(withBasePath(`/api/admin/clubs/${club.id}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            city,
            discountPercent: discountPercent.trim() ? Number(discountPercent) : null,
          }),
        }),
      )

      if (!result.ok) {
        const body = result.body as { error?: string; errors?: string[] } | undefined
        if (body?.error === 'DUPLICATE') {
          setErrors(['Клуб с таким названием и городом уже есть.'])
          return
        }
        if (Array.isArray(body?.errors) && body.errors.length > 0) {
          setErrors(body.errors)
          return
        }
        setErrors([result.error])
        return
      }

      const json = result.data
      if (!json.club) {
        setErrors(['Не удалось сохранить клуб'])
        return
      }

      onSaved({
        ...club,
        name: json.club.name,
        city: json.club.city,
        discountPercent: json.club.discountPercent ?? null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      panelClassName={adminModal}
      ariaLabelledBy="admin-club-edit-title"
    >
      <header className={adminModalHead}>
        <h2 id="admin-club-edit-title" className={adminModalTitle}>Редактирование клуба</h2>
        <Button type="button" variant="ghost" className={adminModalClose} onClick={onClose}>
          Закрыть
        </Button>
      </header>

      <div className={cn(adminModalBody, 'space-y-4')}>
        {club && club.registrationsCount > 0 && (
          <p className="text-sm text-muted">
            Изменения применятся к {club.registrationsCount}{' '}
            {club.registrationsCount === 1 ? 'заявке' : 'заявкам'} с этим клубом.
          </p>
        )}

        <AdminInput
          label="Название клуба"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="organization"
        />

        <AdminInput
          label="Город"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          autoComplete="address-level2"
        />

        <AdminInput
          label="Скидка, %"
          type="number"
          min={0}
          max={100}
          step={1}
          inputMode="numeric"
          value={discountPercent}
          onChange={(event) => setDiscountPercent(event.target.value)}
          placeholder="Без скидки"
          hint="Пустое поле — стандартная цена. Скидка применяется к неоплаченным категориям в заявках клуба."
        />

        {errors.length > 0 && (
          <ul className="space-y-1 text-sm text-danger">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </div>

      <div className={adminModalFooter}>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Отмена
        </Button>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </div>
    </Modal>
  )
}
