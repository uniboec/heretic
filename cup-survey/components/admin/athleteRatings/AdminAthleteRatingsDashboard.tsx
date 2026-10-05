'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { getAgeBracketLabel } from '@/lib/athleteRatings/ageCoefficient'
import {
  ATHLETE_RATING_AGE_BRACKET_KEYS,
  type AthleteRatingView,
} from '@/lib/athleteRatings/constants'
import { formatRatingHundredths } from '@/lib/athleteRatings/ratingMath'
import type {
  AthleteRatingAdminResponse,
  AthleteRatingRankedRow,
  AthleteRatingSettings,
} from '@/lib/athleteRatings/types'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import {
  adminPanel,
  adminPanelHeader,
  adminSegmentTab,
  adminSettingsAlertError,
  adminSettingsAlertSuccess,
  adminSettingsLayout,
  adminSettingsPanelBody,
  adminSettingsPanelDesc,
  adminSettingsPanelTitle,
} from '@/lib/ui/adminSurfaceStyles'
import { Button } from '@/components/ui/Button'
import { AdminInput } from '@/components/admin/AdminInput'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AthleteRatingAthleteCell } from '@/components/tournament/AthleteRatingAthleteCell'
import { athleteRatingsAdminTableUi } from '@/components/tournament/athleteRatingsTableUi'
import { participantsTableUi } from '@/components/tournament/participantsUiClasses'
import { formatAgeYears, tournamentPageCopy } from '@/lib/content/tournament-page'

const ratingCopy = tournamentPageCopy.athleteRatings
const adminColumns = ratingCopy.adminColumns
const adminColumnShort = ratingCopy.adminColumnShort
const settingsCopy = ratingCopy.settings

function AdminCountColumnHeader({
  shortLabel,
  fullLabel,
  className,
}: {
  shortLabel: string
  fullLabel: string
  className: string
}) {
  return (
    <th className={className} title={fullLabel}>
      {shortLabel}
    </th>
  )
}

const viewOptions: Array<{ id: AthleteRatingView; label: string }> = [
  { id: 'overall', label: ratingCopy.overall },
  { id: 'tactic_control', label: ratingCopy.tacticControl },
  { id: 'close_control', label: ratingCopy.closeControl },
]

const TOP_PRESETS = [10, 20, 30] as const

type DraftSettings = {
  publicEnabled: boolean
  publicTopLimit: string
  firstPlacePoints: string
  secondPlacePoints: string
  thirdPlacePoints: string
  placeWithoutWinPercent: string
  pointsVictoryPoints: string
  clearAdvantageVictoryPoints: string
  submissionVictoryPoints: string
  chokeVictoryPoints: string
  injuryVictoryPoints: string
  dqVictoryPoints: string
  ageCoefficients: Record<string, string>
}

function toDraft(settings: AthleteRatingSettings): DraftSettings {
  return {
    publicEnabled: settings.publicEnabled,
    publicTopLimit: String(settings.publicTopLimit),
    firstPlacePoints: String(settings.firstPlacePoints),
    secondPlacePoints: String(settings.secondPlacePoints),
    thirdPlacePoints: String(settings.thirdPlacePoints),
    placeWithoutWinPercent: String(settings.placeWithoutWinPercent),
    pointsVictoryPoints: String(settings.pointsVictoryPoints),
    clearAdvantageVictoryPoints: String(settings.clearAdvantageVictoryPoints),
    submissionVictoryPoints: String(settings.submissionVictoryPoints),
    chokeVictoryPoints: String(settings.chokeVictoryPoints),
    injuryVictoryPoints: String(settings.injuryVictoryPoints),
    dqVictoryPoints: String(settings.dqVictoryPoints),
    ageCoefficients: Object.fromEntries(
      ATHLETE_RATING_AGE_BRACKET_KEYS.map((key) => [
        key,
        String(settings.ageCoefficients[key]),
      ]),
    ),
  }
}

function parseIntField(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function BreakdownDetails({ row }: { row: AthleteRatingRankedRow }) {
  const sections = [
    row.breakdown.tacticControl,
    row.breakdown.closeControl,
  ].filter((section): section is NonNullable<typeof section> => section != null)

  return (
    <div className="space-y-4 px-4 py-3 text-sm">
      {sections.map((section) => (
        <div key={section.discipline} className="space-y-2">
          <p className="font-semibold text-foreground">{section.disciplineLabel}</p>
          <ul className="space-y-1 text-muted">
            {section.lines.map((line, lineIndex) => (
              <li key={`${section.discipline}-${lineIndex}-${line.label}-${line.pointsHundredths}`}>
                {line.label} → {formatRatingHundredths(line.pointsHundredths)}
              </li>
            ))}
          </ul>
          <p>
            Промежуточно: {formatRatingHundredths(section.rawHundredths)} · Возраст{' '}
            {section.ageBracketLabel} ×{section.ageCoeffPercent}% ={' '}
            {formatRatingHundredths(section.ratingHundredths)}
          </p>
        </div>
      ))}
      <p className="font-medium text-foreground">
        Общий результат: {formatRatingHundredths(row.breakdown.overallRatingHundredths)}
      </p>
      {row.anomalies.length > 0 ? (
        <ul className="text-amber-700">
          {row.anomalies.map((anomaly) => (
            <li key={anomaly}>{anomaly}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function AdminAthleteRatingsDashboard() {
  const [view, setView] = useState<AthleteRatingView>('overall')
  const [draft, setDraft] = useState<DraftSettings | null>(null)
  const [rows, setRows] = useState<AthleteRatingRankedRow[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState('')
  const [expandedAthleteId, setExpandedAthleteId] = useState<string | null>(null)

  const load = useCallback(async (nextView: AthleteRatingView) => {
    setLoading(true)
    setErrors([])
    try {
      const result = await readJsonResponse<AthleteRatingAdminResponse>(
        await fetch(withBasePath(`/api/admin/athlete-ratings?view=${nextView}`)),
      )
      if (!result.ok) {
        setErrors(['Не удалось загрузить рейтинг спортсменов.'])
        return
      }
      setDraft(toDraft(result.data.settings))
      setRows(result.data.rows)
    } catch {
      setErrors(['Не удалось загрузить рейтинг спортсменов.'])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(view)
  }, [load, view])

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) =>
      [row.displayName, row.clubName, row.city].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [rows, searchQuery])

  const save = async () => {
    if (!draft) return

    const payload = {
      publicEnabled: draft.publicEnabled,
      publicTopLimit: parseIntField(draft.publicTopLimit),
      firstPlacePoints: parseIntField(draft.firstPlacePoints),
      secondPlacePoints: parseIntField(draft.secondPlacePoints),
      thirdPlacePoints: parseIntField(draft.thirdPlacePoints),
      placeWithoutWinPercent: parseIntField(draft.placeWithoutWinPercent),
      pointsVictoryPoints: parseIntField(draft.pointsVictoryPoints),
      clearAdvantageVictoryPoints: parseIntField(draft.clearAdvantageVictoryPoints),
      submissionVictoryPoints: parseIntField(draft.submissionVictoryPoints),
      chokeVictoryPoints: parseIntField(draft.chokeVictoryPoints),
      injuryVictoryPoints: parseIntField(draft.injuryVictoryPoints),
      dqVictoryPoints: parseIntField(draft.dqVictoryPoints),
      ageCoefficients: Object.fromEntries(
        ATHLETE_RATING_AGE_BRACKET_KEYS.map((key) => [key, parseIntField(draft.ageCoefficients[key] ?? '')]),
      ),
    }

    const nextErrors: string[] = []
    for (const [field, value] of Object.entries(payload)) {
      if (field === 'publicEnabled') continue
      if (field === 'ageCoefficients') {
        for (const coeff of Object.values(payload.ageCoefficients)) {
          if (coeff == null || coeff <= 0) nextErrors.push('Проверьте возрастные коэффициенты.')
        }
        continue
      }
      if (value == null || (typeof value === 'number' && value < 0)) {
        nextErrors.push(`Проверьте поле ${field}.`)
      }
    }
    if (payload.publicTopLimit == null || payload.publicTopLimit <= 0) {
      nextErrors.push('Укажите корректный размер публичного ТОПа.')
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    setErrors([])
    setSuccess('')
    try {
      const response = await fetch(withBasePath(`/api/admin/athlete-ratings?view=${view}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          ageCoefficients: Object.fromEntries(
            ATHLETE_RATING_AGE_BRACKET_KEYS.map((key) => [
              key,
              payload.ageCoefficients[key] as number,
            ]),
          ),
        }),
      })
      const result = await readJsonResponse<{
        settings: AthleteRatingSettings
        rows: AthleteRatingRankedRow[]
      }>(response)
      if (!result.ok) {
        setErrors(['Не удалось сохранить настройки рейтинга.'])
        return
      }
      setDraft(toDraft(result.data.settings))
      setRows(result.data.rows)
      setSuccess('Настройки рейтинга сохранены, расчёт обновлён.')
    } catch {
      setErrors(['Не удалось сохранить настройки рейтинга.'])
    } finally {
      setSaving(false)
    }
  }

  if (loading && !draft) {
    return <p className="text-sm text-muted">Загрузка рейтинга…</p>
  }

  if (!draft) {
    return (
      <div className={adminSettingsAlertError}>
        <p>Не удалось загрузить рейтинг.</p>
        <Button className="mt-3" onClick={() => void load(view)}>
          Повторить
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Рейтинг спортсменов"
        description="Настройки формулы, полный рейтинг всех участников и предпросмотр публичного ТОПа."
      />

      <section className={adminSettingsLayout}>
        <section className={adminPanel}>
          <div className={adminPanelHeader}>
            <div>
              <p className={adminSettingsPanelTitle}>Настройки рейтинга</p>
              <p className={adminSettingsPanelDesc}>
                После сохранения рейтинг пересчитывается автоматически.
              </p>
            </div>
          </div>

          {errors.length > 0 ? (
            <div className={cn(adminSettingsAlertError, 'mx-4 mt-4 sm:mx-5')}>
              {errors.map((error) => <p key={error}>{error}</p>)}
            </div>
          ) : null}
          {success ? (
            <div className={cn(adminSettingsAlertSuccess, 'mx-4 mt-4 sm:mx-5')}>{success}</div>
          ) : null}

          <div className={adminSettingsPanelBody}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.publicEnabled}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, publicEnabled: event.target.checked } : current,
                  )
                }
              />
              Показывать публичный рейтинг
            </label>

            <div className="space-y-2">
              <p className={adminSettingsPanelTitle}>Количество спортсменов в публичном ТОПе</p>
              <div className="flex flex-wrap gap-2">
                {TOP_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    variant={draft.publicTopLimit === String(preset) ? 'primary' : 'secondary'}
                    onClick={() =>
                      setDraft((current) =>
                        current ? { ...current, publicTopLimit: String(preset) } : current,
                      )
                    }
                  >
                    {preset}
                  </Button>
                ))}
              </div>
              <AdminInput
                label="Своё значение"
                type="number"
                min={1}
                value={draft.publicTopLimit}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, publicTopLimit: event.target.value } : current,
                  )
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <AdminInput
                label="1 место"
                type="number"
                min={0}
                value={draft.firstPlacePoints}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, firstPlacePoints: event.target.value } : current,
                  )
                }
              />
              <AdminInput
                label="2 место"
                type="number"
                min={0}
                value={draft.secondPlacePoints}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, secondPlacePoints: event.target.value } : current,
                  )
                }
              />
              <AdminInput
                label="3 место"
                type="number"
                min={0}
                value={draft.thirdPlacePoints}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, thirdPlacePoints: event.target.value } : current,
                  )
                }
              />
            </div>

            <AdminInput
              label="Место без зачётной победы (%)"
              type="number"
              min={0}
              max={100}
              value={draft.placeWithoutWinPercent}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, placeWithoutWinPercent: event.target.value } : current,
                )
              }
            />

            <div className="space-y-2">
              <p className={adminSettingsPanelTitle}>{settingsCopy.victoryPointsTitle}</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  Object.entries(settingsCopy.victoryPoints) as Array<
                    [keyof typeof settingsCopy.victoryPoints, string]
                  >
                ).map(([field, label]) => (
                  <AdminInput
                    key={field}
                    label={label}
                    type="number"
                    min={0}
                    value={draft[field]}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, [field]: event.target.value } : current,
                      )
                    }
                  />
                ))}
              </div>
            </div>

            <div className={`${adminPanel} bg-background-soft/40 p-4 text-sm text-muted`}>
              {settingsCopy.forfeitNote}
            </div>

            <div className="space-y-2">
              <p className={adminSettingsPanelTitle}>{settingsCopy.ageCoefficientsTitle}</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ATHLETE_RATING_AGE_BRACKET_KEYS.map((key) => (
                <AdminInput
                  key={key}
                  label={settingsCopy.ageCoefficientLabel(getAgeBracketLabel(key))}
                  type="number"
                  min={1}
                  value={draft.ageCoefficients[key] ?? ''}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            ageCoefficients: {
                              ...current.ageCoefficients,
                              [key]: event.target.value,
                            },
                          }
                        : current,
                    )
                  }
                />
              ))}
              </div>
            </div>

            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить настройки'}
            </Button>
          </div>
        </section>
      </section>

      <section className={adminPanel}>
        <div className={adminPanelHeader}>
          <div>
            <p className={adminSettingsPanelTitle}>Полный рейтинг</p>
            <p className={adminSettingsPanelDesc}>
              Все участники турнира с детализацией расчёта.
            </p>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap gap-1">
            {viewOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={adminSegmentTab(view === option.id)}
                onClick={() => setView(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <AdminInput
            label="Поиск по ФИО, клубу или городу"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />

          <div className={athleteRatingsAdminTableUi.wrap}>
            <table className={athleteRatingsAdminTableUi.table}>
              <thead>
                <tr>
                  <th className={athleteRatingsAdminTableUi.rankTh}>{adminColumns.rank}</th>
                  <th className={athleteRatingsAdminTableUi.athleteTh}>{adminColumns.athlete}</th>
                  <th className={athleteRatingsAdminTableUi.ageTh}>{adminColumns.age}</th>
                  <th className={athleteRatingsAdminTableUi.scoreTh}>{adminColumns.tacticControl}</th>
                  <th className={athleteRatingsAdminTableUi.scoreTh}>{adminColumns.closeControl}</th>
                  <th className={athleteRatingsAdminTableUi.placementsTh}>{adminColumns.placements}</th>
                  <AdminCountColumnHeader
                    className={athleteRatingsAdminTableUi.countTh}
                    shortLabel={adminColumnShort.wins}
                    fullLabel={adminColumns.wins}
                  />
                  <AdminCountColumnHeader
                    className={athleteRatingsAdminTableUi.countTh}
                    shortLabel={adminColumnShort.pointsVictories}
                    fullLabel={adminColumns.pointsVictories}
                  />
                  <AdminCountColumnHeader
                    className={athleteRatingsAdminTableUi.countTh}
                    shortLabel={adminColumnShort.submissionChoke}
                    fullLabel={adminColumns.submissionChoke}
                  />
                  <AdminCountColumnHeader
                    className={athleteRatingsAdminTableUi.countTh}
                    shortLabel={adminColumnShort.injury}
                    fullLabel={adminColumns.injury}
                  />
                  <AdminCountColumnHeader
                    className={athleteRatingsAdminTableUi.countTh}
                    shortLabel={adminColumnShort.dq}
                    fullLabel={adminColumns.dq}
                  />
                  <AdminCountColumnHeader
                    className={athleteRatingsAdminTableUi.countTh}
                    shortLabel={adminColumnShort.forfeit}
                    fullLabel={adminColumns.forfeit}
                  />
                  <th className={athleteRatingsAdminTableUi.totalTh}>{adminColumns.total}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <Fragment key={row.athleteId}>
                    <tr
                      className={cn(participantsTableUi.rowHover, 'cursor-pointer')}
                      onClick={() =>
                        setExpandedAthleteId((current) =>
                          current === row.athleteId ? null : row.athleteId,
                        )
                      }
                    >
                      <td className={athleteRatingsAdminTableUi.rankTd}>
                        {row.unranked ? (
                          <span className={athleteRatingsAdminTableUi.rankUnranked}>
                            {ratingCopy.unranked}
                          </span>
                        ) : (
                          <span className={athleteRatingsAdminTableUi.rankValue}>{row.rank}</span>
                        )}
                      </td>
                      <td className={athleteRatingsAdminTableUi.athleteTd}>
                        <AthleteRatingAthleteCell
                          displayName={`${row.displayName}${row.anomalies.length > 0 ? ' ⚠' : ''}`}
                          clubName={row.clubName}
                          city={row.city}
                        />
                      </td>
                      <td className={athleteRatingsAdminTableUi.ageTd}>{formatAgeYears(row.ageYears)}</td>
                      <td className={athleteRatingsAdminTableUi.scoreTd}>
                        {formatRatingHundredths(row.tacticControlRatingHundredths)}
                      </td>
                      <td className={athleteRatingsAdminTableUi.scoreTd}>
                        {formatRatingHundredths(row.closeControlRatingHundredths)}
                      </td>
                      <td className={athleteRatingsAdminTableUi.placementsTd}>{row.placementSummary}</td>
                      <td className={athleteRatingsAdminTableUi.countTd}>{row.wins}</td>
                      <td className={athleteRatingsAdminTableUi.countTd}>{row.pointsWins}</td>
                      <td className={athleteRatingsAdminTableUi.countTd}>{row.submissionChokeWins}</td>
                      <td className={athleteRatingsAdminTableUi.countTd}>{row.injuryWins}</td>
                      <td className={athleteRatingsAdminTableUi.countTd}>{row.dqWins}</td>
                      <td className={athleteRatingsAdminTableUi.countTd}>{row.forfeitWins}</td>
                      <td className={athleteRatingsAdminTableUi.totalTd}>
                        {formatRatingHundredths(row.overallRatingHundredths)}
                      </td>
                    </tr>
                    {expandedAthleteId === row.athleteId ? (
                      <tr key={`${row.athleteId}-details`}>
                        <td colSpan={13} className="bg-background-soft/40">
                          <BreakdownDetails row={row} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
