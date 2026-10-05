'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import {
  announcerPanel,
  announcerPanelBody,
  announcerPanelDesc,
  announcerPanelHeader,
  announcerPanelTitle,
} from '@/lib/ui/announcerUiClasses'

export function AnnouncerPanel(input: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn(announcerPanel, input.className)}>
      <div className={announcerPanelHeader}>
        <div className="min-w-0">
          <h2 className={announcerPanelTitle}>{input.title}</h2>
          {input.description ? <p className={announcerPanelDesc}>{input.description}</p> : null}
        </div>
        {input.actions ? <div className="flex shrink-0 flex-wrap gap-2">{input.actions}</div> : null}
      </div>
      <div className={cn(announcerPanelBody, input.bodyClassName)}>{input.children}</div>
    </section>
  )
}
