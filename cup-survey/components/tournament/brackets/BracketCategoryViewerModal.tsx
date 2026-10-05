'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePublishedScheduleDisplayByBoutId } from '@/lib/bouts/usePublishedScheduleDisplayByBoutId'
import { X } from 'lucide-react'
import { BracketSystemRenderer } from '@/components/tournament/brackets/BracketSystemRenderer'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  loadAdminBracketCategoryViewer,
  loadPublicBracketCategoryViewer,
  type BracketCategoryViewerData,
} from '@/lib/brackets/loadBracketCategoryViewer'

export type BracketCategoryViewerRequest = {
  categoryKey: string
  categoryTitle?: string | null
  variant: 'admin' | 'public'
  live?: boolean
}

export function BracketCategoryViewerModal({
  request,
  onClose,
}: {
  request: BracketCategoryViewerRequest | null
  onClose: () => void
}) {
  const open = request != null
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<BracketCategoryViewerData | null>(null)
  const scheduleDisplayByBoutId = usePublishedScheduleDisplayByBoutId()
  const boutsReleased = useMemo(() => {
    if (!request?.categoryKey) return false
    const prefix = `${request.categoryKey}::`
    for (const boutId of scheduleDisplayByBoutId.keys()) {
      if (boutId.startsWith(prefix)) return true
    }
    return false
  }, [request?.categoryKey, scheduleDisplayByBoutId])

  useEffect(() => {
    if (!request) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)

    const load =
      request.variant === 'admin'
        ? loadAdminBracketCategoryViewer(request.categoryKey, { live: request.live ?? true })
        : loadPublicBracketCategoryViewer(request.categoryKey)

    void load
      .then((payload) => {
        if (cancelled) return
        setData(payload)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить сетку')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [request])

  const title = request?.categoryTitle ?? data?.categoryTitle ?? 'Сетка категории'

  return (
    <Modal
      open={open}
      onClose={onClose}
      layer="base"
      size="xl"
      panelClassName="bracket-category-viewer-modal flex max-h-[min(92dvh,56rem)] flex-col overflow-hidden rounded-t-xl border border-border bg-card shadow-xl sm:rounded-xl"
      ariaLabelledBy="bracket-category-viewer-title"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 id="bracket-category-viewer-title" className="truncate text-base font-semibold text-foreground">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-muted">Просмотр сетки с участниками</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-8 w-8 shrink-0 p-0"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-muted">Загрузка сетки…</p>
        ) : error ? (
          <p className="py-12 text-center text-sm text-danger-foreground">{error}</p>
        ) : data ? (
          <BracketSystemRenderer
            variant={request?.variant === 'admin' ? 'admin' : 'event'}
            systemId={data.effectiveSystemId}
            structure={data.structure}
            participants={data.participants}
            result={data.result}
            categoryKey={data.categoryKey}
            boutsReleased={boutsReleased}
            scheduleDisplayByBoutId={scheduleDisplayByBoutId}
          />
        ) : null}
      </div>
    </Modal>
  )
}
