'use client'

import type { BalanceDelta, DrawBalanceReport } from '@/lib/brackets/core/drawBalanceHelpers'

interface AdminBracketDrawBalancePanelProps {
  report: DrawBalanceReport | null
  balanceDelta: BalanceDelta | null
}

export function AdminBracketDrawBalancePanel({
  report,
  balanceDelta,
}: AdminBracketDrawBalancePanelProps) {
  if (!report && !balanceDelta) return null

  return (
    <section className="rounded-lg border border-border bg-muted/10 p-4">
      <h3 className="text-sm font-semibold">Баланс жеребьёвки</h3>

      {balanceDelta && balanceDelta.lines.length > 0 && (
        <div className="mt-3 space-y-1 text-sm text-muted">
          <p className="font-medium text-foreground">Изменение после операции</p>
          <ul className="list-disc pl-5">
            {balanceDelta.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {report && (
        <div className="mt-3 space-y-2 text-sm">
          {report.summary.clubLines.length > 0 && (
            <div>
              <p className="font-medium">Клубы</p>
              <ul className="mt-1 list-disc pl-5 text-muted">
                {report.summary.clubLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {report.summary.cityLines.length > 0 && (
            <div>
              <p className="font-medium">Города</p>
              <ul className="mt-1 list-disc pl-5 text-muted">
                {report.summary.cityLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {report.summary.warnings.length > 0 && (
            <div className="rounded-md border border-warning-border bg-warning-soft px-3 py-2 text-warning-foreground">
              <p className="font-medium">Предупреждения</p>
              <ul className="mt-1 list-disc pl-5">
                {report.summary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {report.searchOptimal === true && report.optimalLayoutMetrics && (
            <p className="text-xs text-muted">
              Поиск оптимальной раскладки выполнен (policy {report.drawPolicyId} v
              {report.drawPolicyVersion}).
            </p>
          )}

          {report.searchOptimal === false && (
            <p className="text-xs text-muted">
              Использована жадная раскладка — метрики оптимальности недоступны.
            </p>
          )}

          {report.currentEarlyConflicts.length > 0 && (
            <div className="mt-2 space-y-1 text-sm text-warning-foreground">
              {report.currentEarlyConflicts.map((conflict) => (
                <p key={`${conflict.kind}-${conflict.groupKey}-${conflict.meetingRound}`}>
                  {conflict.message}
                </p>
              ))}
            </div>
          )}

          {report.searchOptimal === true && (
            <p className="mt-2 text-sm text-success-foreground">
              Найдена оптимальная раскладка по политике {report.drawPolicyId}.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
