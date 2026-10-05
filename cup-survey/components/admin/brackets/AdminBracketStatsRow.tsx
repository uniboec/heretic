'use client'

import { AdminStatCard } from '@/components/admin/AdminStatCard'

interface AdminBracketStatsRowProps {
  categoryCount: number
  activeCount: number
  publicVisibleCount: number
  staleCompositionCount: number
  staleRedrawCount: number
}

export function AdminBracketStatsRow({
  categoryCount,
  activeCount,
  publicVisibleCount,
  staleCompositionCount,
  staleRedrawCount,
}: AdminBracketStatsRowProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <AdminStatCard label="Категорий" value={String(categoryCount)} />
      <AdminStatCard label="Активных" value={String(activeCount)} />
      <AdminStatCard label="На сайте" value={String(publicVisibleCount)} />
      <AdminStatCard label="Устарел состав" value={String(staleCompositionCount)} />
      <AdminStatCard label="Нужна жеребьёвка" value={String(staleRedrawCount)} />
    </div>
  )
}
