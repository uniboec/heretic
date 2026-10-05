'use client'

import { useCallback, useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { adminCompactActionBtn } from '@/lib/ui/adminSurfaceStyles'
import { announcerHistoryItem } from '@/lib/ui/announcerUiClasses'
import { AnnouncerPanel } from './AnnouncerPanel'

export function AdminAnnouncerPronunciationPanel() {
  const [items, setItems] = useState<Array<{ sourceText: string; spokenText: string }>>([])
  const [sourceText, setSourceText] = useState('')
  const [spokenText, setSpokenText] = useState('')
  const [editingSourceText, setEditingSourceText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const response = await fetch(withBasePath('/api/admin/announcer/pronunciation'), { cache: 'no-store' })
    const result = await readJsonResponse<{ items: Array<{ sourceText: string; spokenText: string }> }>(response)
    if (result.ok && result.data) setItems(result.data.items)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setSourceText('')
    setSpokenText('')
    setEditingSourceText(null)
  }

  const save = async () => {
    setBusy(true)
    try {
      const response = await fetch(withBasePath('/api/admin/announcer/pronunciation'), {
        method: editingSourceText ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingSourceText
            ? { originalSourceText: editingSourceText, sourceText, spokenText }
            : { sourceText, spokenText },
        ),
      })
      if (!response.ok) return
      resetForm()
      await load()
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (item: { sourceText: string; spokenText: string }) => {
    setEditingSourceText(item.sourceText)
    setSourceText(item.sourceText)
    setSpokenText(item.spokenText)
  }

  const remove = async (source: string) => {
    setBusy(true)
    try {
      await fetch(withBasePath('/api/admin/announcer/pronunciation'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceText: source }),
      })
      if (editingSourceText === source) resetForm()
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnnouncerPanel
      title="Словарь произношения"
      description="Замены для TTS: как писать в тексте → как должно звучать."
      actions={
        <Button variant="secondary" className={adminCompactActionBtn} onClick={() => void load()}>
          Обновить
        </Button>
      }
    >
      <div className="mb-5 space-y-3">
        {editingSourceText ? (
          <p className="text-sm text-muted">
            Редактирование: <span className="font-medium text-foreground">{editingSourceText}</span>
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Input
            label="Исходный текст"
            placeholder="ММА"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
          />
          <Input
            label="Как произносить"
            placeholder="эм-эм-а"
            value={spokenText}
            onChange={(e) => setSpokenText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 sm:mb-0.5">
            <Button onClick={() => void save()} disabled={busy || !sourceText || !spokenText}>
              {editingSourceText ? 'Сохранить' : 'Добавить'}
            </Button>
            {editingSourceText ? (
              <Button variant="secondary" onClick={resetForm} disabled={busy}>
                Отмена
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.sourceText}
            className={`${announcerHistoryItem}${editingSourceText === item.sourceText ? ' border-accent/35 bg-accent-soft/20' : ''}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-sm">
                <span className="font-semibold text-foreground">{item.sourceText}</span>
                <span className="mx-2 text-muted">→</span>
                <span className="text-foreground">{item.spokenText}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="secondary"
                  className={adminCompactActionBtn}
                  onClick={() => startEdit(item)}
                  disabled={busy}
                >
                  Изменить
                </Button>
                <Button
                  variant="secondary"
                  className={adminCompactActionBtn}
                  onClick={() => void remove(item.sourceText)}
                  disabled={busy}
                >
                  Удалить
                </Button>
              </div>
            </div>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            Словарь пуст
          </li>
        ) : null}
      </ul>
    </AnnouncerPanel>
  )
}
