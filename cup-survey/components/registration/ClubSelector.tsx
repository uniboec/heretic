'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { Button } from '@/components/ui/Button'
import { CollapsePanel } from '@/components/ui/CollapsePanel'
import { Input } from '@/components/ui/Input'
import { EventField, EventInput } from './EventFormFields'

export interface ClubSelection {
  clubId: string | null
  clubName: string
  city: string
  discountPercent?: number | null
}

interface ClubOption {
  id: string
  name: string
  city: string
  discountPercent?: number | null
}

const copy = tournamentPageCopy.registration

interface Props {
  value: ClubSelection
  onChange: (value: ClubSelection) => void
}

export function ClubSelector({ value, onChange }: Props) {
  const [clubs, setClubs] = useState<ClubOption[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'select' | 'new'>(value.clubId ? 'select' : 'select')
  const containerRef = useRef<HTMLDivElement>(null)

  const loadClubs = useCallback((search: string) => {
    setLoading(true)
    const params = search ? `?q=${encodeURIComponent(search)}` : ''
    return fetch(withBasePath(`/api/tournament/clubs${params}`))
      .then((response) => readJsonResponse<{ clubs?: ClubOption[] }>(response))
      .then((result) => setClubs(result.ok ? (result.data.clubs ?? []) : []))
      .catch(() => setClubs([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadClubs('')
  }, [loadClubs])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => loadClubs(query), query ? 200 : 0)
    return () => clearTimeout(timer)
  }, [query, open, loadClubs])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const displayValue = useMemo(() => {
    if (!value.clubName) return ''
    if (value.city) return `${value.clubName}, ${value.city}`
    return value.clubName
  }, [value.clubName, value.city])

  const selectClub = (club: ClubOption) => {
    onChange({
      clubId: club.id,
      clubName: club.name,
      city: club.city,
      discountPercent: club.discountPercent ?? null,
    })
    setQuery('')
    setMode('select')
    setOpen(false)
  }

  const startNewClub = () => {
    onChange({ clubId: null, clubName: '', city: '', discountPercent: null })
    setMode('new')
    setOpen(false)
  }

  const openList = () => {
    setOpen(true)
    if (value.clubId) {
      setQuery('')
      loadClubs('')
    }
  }

  if (mode === 'new') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-[var(--color-foreground)]">{copy.clubAddNew}</p>
          <Button
            type="button"
            variant="ghost"
            className="text-sm font-medium text-[var(--color-accent)]"
            onClick={() => {
              setMode('select')
              onChange({ clubId: null, clubName: '', city: '', discountPercent: null })
              openList()
            }}
          >
            Выбрать из списка
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <EventInput
            label={copy.clubNewName}
            value={value.clubName}
            onChange={(e) => onChange({ ...value, clubId: null, clubName: e.target.value, discountPercent: null })}
            placeholder="СК «Универсальные бойцы»"
          />
          <EventInput
            label={copy.clubNewCity}
            value={value.city}
            onChange={(e) => onChange({ ...value, clubId: null, city: e.target.value, discountPercent: null })}
            placeholder="Первоуральск"
          />
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          Клуб появится в списке после регистрации и будет доступен другим участникам.
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <EventField label={copy.clubSelectLabel} id="club-select">
        <div className="relative">
          <Input
            controlOnly
            id="club-select"
            className="pr-10"
            value={open ? query : displayValue}
            placeholder={copy.clubSelectPlaceholder}
            autoComplete="off"
            aria-autocomplete="list"
            role="combobox"
            aria-expanded={open}
            onChange={(e) => {
              const next = e.target.value
              setQuery(next)
              setOpen(true)
              onChange({ clubId: null, clubName: next, city: value.city, discountPercent: null })
            }}
            onFocus={openList}
          />
          <Button
            type="button"
            variant="ghost"
            aria-label="Показать список клубов"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--color-muted)]"
            onClick={() => (open ? setOpen(false) : openList())}
          >
            <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                clipRule="evenodd"
              />
            </svg>
          </Button>
        </div>
      </EventField>

      {!open && (
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">{copy.clubSelectHint}</p>
      )}

      {value.clubId && !open && (
        <p className="mt-1 text-xs font-medium text-[var(--color-accent)]">
          {copy.clubSelected}: {value.clubName}, {value.city}
        </p>
      )}

      <CollapsePanel
        open={open}
        className="club-selector-dropdown absolute z-50 mt-1 w-full rounded-xl border border-[var(--color-border)] bg-white shadow-lg"
        innerClassName="overflow-hidden"
      >
        <div role="listbox">
          {!query && clubs.length > 0 && (
            <p className="border-b border-[var(--color-border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {copy.clubListTitle}
            </p>
          )}
          <ul className="max-h-[min(16rem,50dvh)] overflow-y-auto overscroll-contain py-1 sm:max-h-60">
            {loading && (
              <li className="px-4 py-3 text-sm text-[var(--color-muted)]">{copy.clubListLoading}</li>
            )}
            {!loading &&
              clubs.map((club) => (
                <li key={club.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    className={`flex w-full flex-col items-start px-4 py-2.5 text-left text-sm hover:bg-[var(--color-surface)] ${
                      value.clubId === club.id ? 'bg-[var(--color-accent-soft)]' : ''
                    }`}
                    onClick={() => selectClub(club)}
                  >
                    <span className="font-medium text-[var(--color-foreground)]">{club.name}</span>
                    <span className="text-[var(--color-muted)]">{club.city}</span>
                  </Button>
                </li>
              ))}
            {!loading && clubs.length === 0 && query && (
              <li className="px-4 py-3 text-sm text-[var(--color-muted)]">{copy.clubNotFound}</li>
            )}
            {!loading && clubs.length === 0 && !query && (
              <li className="px-4 py-3 text-sm text-[var(--color-muted)]">{copy.clubListEmpty}</li>
            )}
          </ul>
          <div className="border-t border-[var(--color-border)]">
            <Button
              type="button"
              variant="ghost"
              className="w-full px-4 py-3 text-left text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
              onClick={startNewClub}
            >
              + {copy.clubAddNew}
            </Button>
          </div>
        </div>
      </CollapsePanel>
    </div>
  )
}
