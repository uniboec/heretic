'use client'

import { adminPageActionsBtn, adminPanel, adminPanelHeader, adminCards, adminTableDesktop, adminTableWrap, adminRowCard, adminStatCardMeta } from '@/lib/ui/adminSurfaceStyles'
import { AdminResponsesList } from '@/components/admin/AdminResponsesList'
import type { AdminStats } from '@/lib/analytics'
import { formatMoney } from '@/lib/formatMoney'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import { useCallback, useEffect, useState } from 'react'
import { AdminPageHeader } from './AdminPageHeader'
import { AdminStatCard } from './AdminStatCard'

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState('')

  const loadStats = useCallback(() => {
    fetch(withBasePath('/api/admin/stats'))
      .then((res) => readJsonResponse<AdminStats>(res))
      .then((result) => {
        if (!result.ok) throw new Error(result.error ?? 'Unauthorized')
        setStats(result.data)
      })
      .catch(() => setError('Не удалось загрузить статистику'))
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  if (error) {
    return <p className="rounded-xl border border-accent/20 bg-accent-soft px-4 py-3 text-sm text-accent">{error}</p>
  }

  if (!stats) {
    return <p className="text-sm text-muted">Загрузка статистики…</p>
  }

  const exportActions = (
    <>
      <a href={withBasePath('/api/admin/export?format=csv')}>
        <Button variant="secondary" className={adminPageActionsBtn}>CSV</Button>
      </a>
      <a href={withBasePath('/api/admin/export?format=xlsx')}>
        <Button variant="secondary" className={adminPageActionsBtn}>XLSX</Button>
      </a>
    </>
  )

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Результаты опроса"
        description="Аналитика по анкетам тренеров и руководителей команд."
        actions={exportActions}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <AdminStatCard label="Всего ответов" value={String(stats.totalResponses)} />
        <AdminStatCard label="Команд с данными" value={String(stats.teamsWithAthleteData)} />
        <AdminStatCard label="Известных спортсменов" value={String(stats.totalKnownAthletes)} />
      </section>

      <p className="rounded-xl border border-border bg-background-soft/60 px-4 py-3 text-sm text-muted">
        {stats.athleteDataNote}
      </p>

      <StatsTable title="Приемлемые площадки" rows={stats.venueStats} total={stats.totalResponses} />
      <StatsTable title="Основная площадка" rows={stats.preferredVenueStats} total={stats.totalResponses} />
      <StatsTable title="Основные медали" rows={stats.preferredMedalStats} total={stats.totalResponses} />
      <StatsTable title="Основные пояса" rows={stats.preferredBeltStats} total={stats.totalResponses} />
      <StatsTable title="Основные кубки" rows={stats.preferredCupStats} total={stats.totalResponses} />
      <StatsTable title="Формат по дням" rows={stats.dayFormatStats} total={stats.totalResponses} />
      <StatsTable title="Интересующие дисциплины" rows={stats.disciplineStats} total={stats.totalResponses} />
      <StatsTable title="Комплектация призов" rows={stats.prizeCompositionStats} total={stats.totalResponses} />
      <StatsTable
        title="Приемлемые наградные пакеты"
        rows={stats.awardPackageStats}
        total={stats.totalResponses}
      />
      <StatsTable
        title="Основной наградный пакет"
        rows={stats.primaryAwardPackageStats}
        total={stats.totalResponses}
      />

      <EntryFeeStatsSection rows={stats.entryFeeStats} />
      <ScenarioMatrixSection rows={stats.scenarioMatrix} />

      {stats.possibleDuplicates.length > 0 && (
        <section className="rounded-xl border border-warning-border/80 bg-warning-soft/50 p-4">
          <h2 className="text-base font-bold text-warning-foreground">Возможные дубликаты клубов</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-warning-foreground/80">
            {stats.possibleDuplicates.map((d) => (
              <li key={`${d.organizationName}-${d.phone}`}>
                {d.organizationName} ({d.phone}) — {d.count} анкет
              </li>
            ))}
          </ul>
        </section>
      )}

      <AdminResponsesList />
    </div>
  )
}

function StatsTable({
  title,
  rows,
  total,
}: {
  title: string
  rows: AdminStats['venueStats']
  total: number
}) {
  if (!rows.length) return null

  return (
    <section className={`${adminPanel} overflow-hidden`}>
      <div className={adminPanelHeader}>{title}</div>
      <div className={adminCards}>
        {rows.map((row) => (
          <article key={row.id} className={adminRowCard}>
            <p className="font-semibold text-foreground">{row.label}</p>
            <dl className={adminStatCardMeta}>
              <div>
                <dt>Команды</dt>
                <dd>{row.teamsCount} из {total} ({row.teamsPercent}%)</dd>
              </div>
              <div>
                <dt>Спортсмены</dt>
                <dd>{row.athletesCount} ({row.athletesPercent}% известных)</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className={`${adminTableDesktop} ${adminTableWrap}`}>
        <Table>
          <thead>
            <tr>
              <th>Вариант</th>
              <th>Команды</th>
              <th>Спортсмены</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="font-medium">{row.label}</td>
                <td>
                  {row.teamsCount} из {total} ({row.teamsPercent}%)
                </td>
                <td>
                  {row.athletesCount} спортсменов ({row.athletesPercent}% известных)
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </section>
  )
}

function EntryFeeStatsSection({ rows }: { rows: AdminStats['entryFeeStats'] }) {
  return (
    <section className={`${adminPanel} overflow-hidden`}>
      <div className={adminPanelHeader}>Распределение стартового взноса</div>
      <p className="border-b border-border px-4 py-3 text-sm text-muted">
        По основным выборам каждой команды: площадка, медали, пояса и кубки.
      </p>
      <div className={adminCards}>
        {rows.map((row) => (
          <article key={row.total} className={adminRowCard}>
            <p className="price-value font-semibold text-accent">{row.label}</p>
            <dl className={adminStatCardMeta}>
              <div>
                <dt>Команды</dt>
                <dd>{row.teamsCount} ({row.teamsPercent}%)</dd>
              </div>
              <div>
                <dt>Спортсмены</dt>
                <dd>{row.athletesCount} ({row.athletesPercent}%)</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className={`${adminTableDesktop} ${adminTableWrap}`}>
        <Table>
          <thead>
            <tr>
              <th>Сумма</th>
              <th>Команды</th>
              <th>Спортсмены</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.total}>
                <td className="price-value font-semibold text-accent">{row.label}</td>
                <td>
                  {row.teamsCount} ({row.teamsPercent}%)
                </td>
                <td>
                  {row.athletesCount} ({row.athletesPercent}%)
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </section>
  )
}

function ScenarioMatrixSection({ rows }: { rows: AdminStats['scenarioMatrix'] }) {
  return (
    <section className={`${adminPanel} overflow-hidden`}>
      <div className={adminPanelHeader}>Основной расчёт: площадка + награды</div>
      <p className="border-b border-border px-4 py-3 text-sm text-muted">
        Сочетания, которые команды выбрали как основные для расчёта взноса.
      </p>
      <div className={adminCards}>
        {rows.map((row) => (
          <article key={`${row.venueId}-${row.packageId}`} className={adminRowCard}>
            <p className="font-semibold text-foreground">{row.venueName} + {row.packageLabel}</p>
            <p className="mt-1 price-value font-semibold text-accent">
              {formatMoney(row.totalEntryFee, { plus: false })}
            </p>
            <dl className={adminStatCardMeta}>
              <div>
                <dt>Команды</dt>
                <dd>{row.teamsCount} ({row.teamsPercent}%)</dd>
              </div>
              <div>
                <dt>Спортсмены</dt>
                <dd>{row.athletesCount} ({row.athletesPercent}%)</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className={`${adminTableDesktop} ${adminTableWrap}`}>
        <Table>
          <thead>
            <tr>
              <th>Сценарий</th>
              <th>Итоговый взнос</th>
              <th>Команды</th>
              <th>Спортсмены</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.venueId}-${row.packageId}`}>
                <td className="font-medium">
                  {row.venueName} + {row.packageLabel}
                </td>
                <td className="price-value font-semibold text-accent">
                  {formatMoney(row.totalEntryFee, { plus: false })}
                </td>
                <td>
                  {row.teamsCount} ({row.teamsPercent}%)
                </td>
                <td>
                  {row.athletesCount} ({row.athletesPercent}%)
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </section>
  )
}
