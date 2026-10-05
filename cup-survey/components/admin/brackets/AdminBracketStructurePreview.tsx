'use client'

import { useRef, useState } from 'react'
import { usePublishedScheduleDisplayByBoutId } from '@/lib/bouts/usePublishedScheduleDisplayByBoutId'
import { FileDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { BRACKET_EXPORT_LABELS } from '@/lib/brackets/labels'
import { buildBracketBoutId } from '@/lib/brackets/buildBracketBoutId'
import {
  BracketSystemRenderer,
  type AdminBracketMatchSelectInput,
} from '@/components/tournament/brackets/BracketSystemRenderer'
import { adminPanel, adminPanelHeader } from '@/lib/ui/adminSurfaceStyles'
import { useAdminCategoryStructure } from '@/lib/brackets/admin/hooks'
import { buildSingleCategoryExportFilename } from '@/lib/brackets/export/filename'
import {
  exportBracketElementToPdf,
  exportBracketElementToWord,
} from '@/lib/brackets/export/clientBracketExport'
import { Button } from '@/components/ui/Button'
import {
  AdminBracketBoutPanelModal,
  type AdminBracketBoutPanelTarget,
} from './AdminBracketBoutPanelModal'
import { buildAdminBracketCategoryMeta } from './AdminBracketBulkCategorySection'
import type { CategoryPanelData } from './AdminBracketCategoryPanel'

interface AdminBracketStructurePreviewProps {
  category: CategoryPanelData
  onToast: (message: string, type?: 'error' | 'success') => void
}

export function AdminBracketStructurePreview({ category, onToast }: AdminBracketStructurePreviewProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const structureQuery = useAdminCategoryStructure(category.categoryKey, true, { live: true })
  const [pdfExportBusy, setPdfExportBusy] = useState(false)
  const [wordExportBusy, setWordExportBusy] = useState(false)
  const [selectedBout, setSelectedBout] = useState<AdminBracketBoutPanelTarget | null>(null)
  const scheduleDisplayByBoutId = usePublishedScheduleDisplayByBoutId()
  const canExport = category.status === 'ACTIVE' && category.participants.length > 0
  const meta = buildAdminBracketCategoryMeta(category, structureQuery.data)

  const handleMatchSelect = (input: AdminBracketMatchSelectInput) => {
    setSelectedBout({
      boutId: buildBracketBoutId(category.categoryKey, input.localMatchId),
      matchLabel: input.label,
      winnerEntryId: input.winnerEntryId,
      loserEntryId: input.loserEntryId,
      sideALabel: input.sideALabel,
      sideBLabel: input.sideBLabel,
      sidesReady: input.sidesReady,
    })
  }

  const handleDownloadPdf = () => {
    if (!sectionRef.current) return
    setPdfExportBusy(true)
    void exportBracketElementToPdf(sectionRef.current, {
      title: category.title,
      meta,
      filename: buildSingleCategoryExportFilename(category.title, 'pdf'),
    })
      .catch((error) => onToast(error instanceof Error ? error.message : 'Не удалось сформировать PDF', 'error'))
      .finally(() => setPdfExportBusy(false))
  }

  const handleDownloadWord = () => {
    if (!sectionRef.current) return
    setWordExportBusy(true)
    void exportBracketElementToWord(sectionRef.current, {
      title: category.title,
      meta,
      filename: buildSingleCategoryExportFilename(category.title),
      categoryKey: category.categoryKey,
    })
      .catch((error) => onToast(error instanceof Error ? error.message : 'Не удалось сформировать Word', 'error'))
      .finally(() => setWordExportBusy(false))
  }

  return (
    <section
      ref={sectionRef}
      className={cn('admin-brackets-print-target min-w-0 print:hidden', adminPanel)}
    >
      <div
        className={cn(
          adminPanelHeader,
          'bracket-export-ignore print:hidden flex flex-wrap items-center justify-between gap-2',
        )}
      >
        <span>Предпросмотр сетки</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={handleDownloadPdf}
            disabled={!canExport || pdfExportBusy || wordExportBusy || structureQuery.isLoading}
          >
            <FileDown className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {pdfExportBusy ? BRACKET_EXPORT_LABELS.generating : BRACKET_EXPORT_LABELS.downloadCategoryPdf}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={handleDownloadWord}
            disabled={!canExport || pdfExportBusy || wordExportBusy || structureQuery.isLoading}
          >
            <FileDown className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {wordExportBusy ? BRACKET_EXPORT_LABELS.generating : BRACKET_EXPORT_LABELS.downloadCategoryWord}
          </Button>
        </div>
      </div>
      <div className="admin-brackets-print-header hidden border-b border-border px-3 py-2 print:block">
        <h2 className="truncate text-base font-semibold">{category.title}</h2>
        <p className="mt-1 text-xs font-normal text-muted">{meta}</p>
      </div>
      <div className="bracket-export-ignore space-y-1 border-b border-border px-3 py-2 text-xs text-muted print:hidden">
        <p>Слоты с подписью «Пропуск» — автоматический bye (олимпийская сетка, N не кратно степени 2).</p>
        <p>Кликните по бою, чтобы посмотреть ход поединка и перейти к панели управления на ковре.</p>
      </div>
      <div className="p-3">
        {structureQuery.isLoading ? (
          <p className="py-8 text-center text-sm text-muted">Загрузка сетки…</p>
        ) : structureQuery.isError ? (
          <p className="py-8 text-center text-sm text-danger-foreground">Не удалось загрузить сетку</p>
        ) : (
          <BracketSystemRenderer
            variant="admin"
            systemId={structureQuery.data?.effectiveSystemId ?? category.effectiveSystemId}
            structure={structureQuery.data?.structure ?? null}
            participants={structureQuery.data?.participants ?? category.participants}
            result={structureQuery.data?.result ?? null}
            categoryKey={category.categoryKey}
            boutsReleased={Boolean(category.boutsReleased)}
            scheduleDisplayByBoutId={scheduleDisplayByBoutId}
            onAdminMatchSelect={handleMatchSelect}
          />
        )}
      </div>

      <AdminBracketBoutPanelModal
        open={selectedBout !== null}
        target={selectedBout}
        boutsReleased={Boolean(category.boutsReleased)}
        onClose={() => setSelectedBout(null)}
      />
    </section>
  )
}
