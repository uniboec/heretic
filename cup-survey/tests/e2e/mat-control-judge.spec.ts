import { test, expect, type Page } from '@playwright/test'
import {
  baseActiveBout,
  buildConfirmedWithNextBoutSnapshot,
  buildDisqualificationReadySnapshot,
  buildMatControlSnapshot,
  buildOutOfBoundsDqSnapshot,
  buildScheduledDqSnapshot,
  buildWarningBeforeDqSnapshot,
  installMatControlMocks,
  loginMatControlUser,
} from './helpers/matControlFixtures'

const LOGIN_SKIP_MESSAGE =
  'Admin auth unavailable (set E2E_ADMIN_PASSWORD in .env or restart dev server with matching ADMIN_SESSION_SECRET)'

function jsonRoute(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

async function installStoppageWizardMocks(
  page: Page,
  stopIntent: string,
  commands?: Array<{ intent: string; payload: Record<string, unknown> }>,
) {
  let boutPhase: 'live' | 'pending_confirmation' = 'live'
  const active = baseActiveBout('live')
  const render = () =>
    buildMatControlSnapshot({
      boutPhase: boutPhase === 'pending_confirmation' ? 'pending_confirmation' : 'live',
      queueOnly: false,
      activeBout: {
        ...active,
        execution: { ...active.execution, boutPhase },
      },
    })

  await installMatControlMocks(page, render())
  await page.route('**/api/admin/bouts/mats/1/control', (route) =>
    route.fulfill(jsonRoute(render())),
  )
  await page.route('**/api/admin/bouts/*/control/command', async (route) => {
    const body = route.request().postDataJSON() as {
      intent?: string
      payload?: Record<string, unknown>
    }
    if (commands) {
      commands.push({ intent: body.intent ?? '', payload: body.payload ?? {} })
    }
    if (body.intent === stopIntent) boutPhase = 'pending_confirmation'
    await route.fulfill(jsonRoute({ ok: true, liveRevision: 1, boutPhase }))
  })
}

async function runFinishWizard(
  page: Page,
  steps: {
    reason: string
    winnerButton?: RegExp | string
    subjectButton?: RegExp | string
    subtypeButton?: string
  },
) {
  await page.getByRole('button', { name: 'Завершить поединок →' }).click()
  await page.getByRole('button', { name: steps.reason }).click()
  if (steps.winnerButton) {
    await page.getByRole('button', { name: steps.winnerButton }).click()
  }
  if (steps.subtypeButton) {
    await page.getByRole('button', { name: steps.subtypeButton }).click()
  }
  if (steps.subjectButton) {
    await page.getByRole('button', { name: steps.subjectButton }).click()
  }
  await page.getByRole('button', { name: 'Подтвердить остановку' }).click()
}

test.describe('judge console advanced flows', () => {
  test.beforeEach(() => {
    test.skip(!process.env.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET is required')
  })

  test('per-corner doctor visit does not block fight button', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const active = baseActiveBout('live')
    const render = () =>
      buildMatControlSnapshot({
        boutPhase: 'live',
        queueOnly: false,
        activeBout: {
          ...active,
          execution: { ...active.execution, clockState: 'stopped' },
          auxiliaryTimers: {
            athleteDoctorVisits: {
              red: {
                entryId: active.participants.redEntryId!,
                accumulatedMs: 5000,
                startedAt: '2026-09-30T10:00:00.000Z',
                isActive: true,
                totalMs: 5000,
                removalAvailable: false,
              },
            },
          },
        },
      })

    await installMatControlMocks(page, render())
    await page.route('**/api/admin/bouts/mats/1/control', (route) =>
      route.fulfill(jsonRoute(render())),
    )

    await page.goto('/admin/bouts/mats/1/control')
    await expect(page.getByText('● Врач')).toBeVisible()
    await expect(page.getByTestId('judge-fight-button')).toBeEnabled()
  })

  test('stale snapshot disables mutations', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    let allowRefresh = true
    const snapshot = buildMatControlSnapshot({ boutPhase: 'live', queueOnly: false })
    await installMatControlMocks(page, snapshot)
    await page.route('**/api/admin/bouts/mats/1/control', (route) => {
      if (!allowRefresh) return route.abort('failed')
      return route.fulfill(jsonRoute(snapshot))
    })

    await page.goto('/admin/bouts/mats/1/control')
    await expect(page.getByRole('button', { name: 'Плюс 4' }).first()).toBeEnabled()
    allowRefresh = false
    await expect(page.getByTestId('judge-disabled-reason')).toContainText(
      'Нет актуальной связи с сервером',
      { timeout: 25_000 },
    )
    await expect(page.getByRole('button', { name: 'Плюс 4' }).first()).toBeDisabled()
  })

  test('stale snapshot does not send command requests', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    let allowRefresh = true
    const commandRequests: Array<{ intent?: string; status?: number }> = []
    const snapshot = buildMatControlSnapshot({ boutPhase: 'live', queueOnly: false })

    await installMatControlMocks(page, snapshot)
    await page.route('**/api/admin/bouts/mats/1/control', (route) => {
      if (!allowRefresh) return route.abort('failed')
      return route.fulfill(jsonRoute(snapshot))
    })
    await page.route('**/api/admin/bouts/*/control/command', async (route) => {
      const body = route.request().postDataJSON() as { intent?: string }
      commandRequests.push({ intent: body.intent })
      await route.fulfill(
        jsonRoute(
          {
            error: 'Конфликт версии',
            code: 'LIVE_REVISION_MISMATCH',
          },
          409,
        ),
      )
    })

    await page.goto('/admin/bouts/mats/1/control')
    await expect(page.getByRole('button', { name: 'Плюс 4' }).first()).toBeEnabled()
    allowRefresh = false
    await expect(page.getByTestId('judge-disabled-reason')).toContainText(
      'Нет актуальной связи с сервером',
      { timeout: 25_000 },
    )

    const beforeAttempts = commandRequests.length
    await page.getByRole('button', { name: 'Плюс 4' }).first().click({ force: true })
    await page.getByRole('button', { name: 'Нарушение' }).first().click({ force: true })
    await page.getByTestId('judge-fight-button').click({ force: true })
    await page.waitForTimeout(500)

    expect(commandRequests.length).toBe(beforeAttempts)
  })

  test('409 DQ path opens modal and sends PENALTY_DISQUALIFY', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const beforeRace = buildWarningBeforeDqSnapshot()
    const afterRace = buildDisqualificationReadySnapshot()
    const commands: Array<{ intent: string; payload: Record<string, unknown>; operationId: string }> =
      []
    let raceHappened = false

    await installMatControlMocks(page, beforeRace)
    await page.route('**/api/admin/bouts/mats/1/control', (route) =>
      route.fulfill(jsonRoute(raceHappened ? afterRace : beforeRace)),
    )
    await page.route('**/api/admin/bouts/*/control/command', async (route) => {
      const body = route.request().postDataJSON() as {
        intent?: string
        payload?: Record<string, unknown>
        operationId?: string
      }
      if (body.intent === 'PENALTY_GENERAL_NEXT') {
        raceHappened = true
        await route.fulfill(
          jsonRoute(
            {
              error: 'Требуется подтверждение дисквалификации',
              code: 'DISQUALIFICATION_CONFIRMATION_REQUIRED',
            },
            409,
          ),
        )
        return
      }
      commands.push({
        intent: body.intent ?? '',
        payload: body.payload ?? {},
        operationId: body.operationId ?? '',
      })
      await route.fulfill(jsonRoute({ ok: true, liveRevision: 2 }))
    })

    await page.goto('/admin/bouts/mats/1/control')
    await page.getByRole('button', { name: 'Нарушение' }).first().click()
    await expect(page.getByText('Подтвердите дисквалификацию')).toBeVisible()
    await page.getByRole('button', { name: 'Дисквалифицировать' }).click()

    const dq = commands.find((c) => c.intent === 'PENALTY_DISQUALIFY')
    expect(dq).toBeTruthy()
    expect(dq?.payload.ladder).toBe('GENERAL')
    expect(dq?.payload.corner).toBe('red')
    expect(dq?.operationId).toBeTruthy()
  })

  test('shows disqualification label for out-of-bounds ladder', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    await installMatControlMocks(page, buildOutOfBoundsDqSnapshot())

    await page.goto('/admin/bouts/mats/1/control')
    await expect(page.getByRole('button', { name: '⚠ ДСК' }).first()).toBeVisible()
  })

  test('DQ penalty button opens confirmation modal', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    await installMatControlMocks(page, buildOutOfBoundsDqSnapshot())

    await page.goto('/admin/bouts/mats/1/control')
    await page.getByRole('button', { name: '⚠ ДСК' }).first().click()
    await expect(page.getByText('Подтвердите дисквалификацию')).toBeVisible()
    await expect(page.getByText(/выход за пределы ковра/i)).toBeVisible()
  })

  test('DQ penalty button opens modal when bout is not next startable', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    await installMatControlMocks(page, buildScheduledDqSnapshot())

    await page.goto('/admin/bouts/mats/1/control')
    await page.getByRole('button', { name: '⚠ ДСК' }).first().click()
    await expect(page.getByText('Подтвердите дисквалификацию')).toBeVisible()
  })

  test('DQ via service menu opens confirmation modal', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)
    await installMatControlMocks(
      page,
      buildMatControlSnapshot({ boutPhase: 'live', queueOnly: false }),
    )

    await page.goto('/admin/bouts/mats/1/control')
    await page.getByRole('button', { name: 'Меню угла' }).nth(1).click()
    await page.getByRole('button', { name: 'Дисквалификация за выход' }).click()
    await expect(page.getByText('Подтвердите дисквалификацию')).toBeVisible()
    await expect(page.getByText(/выход за пределы ковра/i)).toBeVisible()
  })

  test('period correction banner allows finish', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const active = baseActiveBout('live')
    await installMatControlMocks(
      page,
      buildMatControlSnapshot({
        boutPhase: 'live',
        queueOnly: false,
        activeBout: {
          ...active,
          execution: {
            ...active.execution,
            periodCorrectionMode: true,
            clockState: 'stopped',
          },
        },
      }),
    )

    await page.goto('/admin/bouts/mats/1/control')
    await expect(page.getByText('Коррекция счёта основного времени')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Применить исправление' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Плюс 4' }).first()).toBeVisible()
  })

  test('submission wizard sends STOPPAGE_SUBMISSION', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const commands: Array<{ intent: string; payload: Record<string, unknown> }> = []
    await installStoppageWizardMocks(page, 'STOPPAGE_SUBMISSION', commands)

    await page.goto('/admin/bouts/mats/1/control')
    await runFinishWizard(page, {
      reason: 'Болевой приём',
      winnerButton: /Красный/,
      subtypeButton: 'На ногу',
    })

    const stop = commands.find((c) => c.intent === 'STOPPAGE_SUBMISSION')
    expect(stop).toBeTruthy()
    expect(stop?.payload.winnerCorner).toBe('red')
    expect(stop?.payload.submissionSubtype).toBe('LEG')
    await expect(page.getByRole('button', { name: 'Подтвердить результат' })).toBeVisible()
  })

  test('choke wizard sends STOPPAGE_CHOKE', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const commands: Array<{ intent: string; payload: Record<string, unknown> }> = []
    await installStoppageWizardMocks(page, 'STOPPAGE_CHOKE', commands)

    await page.goto('/admin/bouts/mats/1/control')
    await runFinishWizard(page, {
      reason: 'Удушающий приём',
      winnerButton: /Синий/,
    })

    const stop = commands.find((c) => c.intent === 'STOPPAGE_CHOKE')
    expect(stop).toBeTruthy()
    expect(stop?.payload.winnerCorner).toBe('blue')
    await expect(page.getByRole('button', { name: 'Подтвердить результат' })).toBeVisible()
  })

  test('injury wizard sends STOPPAGE_INJURY', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const commands: Array<{ intent: string; payload: Record<string, unknown> }> = []
    await installStoppageWizardMocks(page, 'STOPPAGE_INJURY', commands)

    await page.goto('/admin/bouts/mats/1/control')
    await runFinishWizard(page, {
      reason: 'Невозможность продолжать',
      subjectButton: /\(красный\)/,
    })

    const stop = commands.find((c) => c.intent === 'STOPPAGE_INJURY')
    expect(stop).toBeTruthy()
    expect(stop?.payload.injuredCorner).toBe('red')
    await expect(page.getByRole('button', { name: 'Подтвердить результат' })).toBeVisible()
  })

  test('forfeit wizard completes through confirmation', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    let boutPhase = 'live'
    const active = baseActiveBout('live')
    const render = () =>
      buildMatControlSnapshot({
        boutPhase: boutPhase === 'pending_confirmation' ? 'pending_confirmation' : 'live',
        queueOnly: false,
        activeBout: {
          ...active,
          execution: { ...active.execution, boutPhase },
        },
      })

    await installMatControlMocks(page, render())
    await page.route('**/api/admin/bouts/mats/1/control', (route) =>
      route.fulfill(jsonRoute(render())),
    )
    await page.route('**/api/admin/bouts/*/control/command', async (route) => {
      const body = route.request().postDataJSON() as { intent?: string }
      if (body.intent === 'STOPPAGE_FORFEIT') boutPhase = 'pending_confirmation'
      await route.fulfill(jsonRoute({ ok: true, liveRevision: 1, boutPhase }))
    })

    await page.goto('/admin/bouts/mats/1/control')
    await page.getByRole('button', { name: 'Завершить поединок →' }).click()
    await page.getByRole('button', { name: 'Отказ от продолжения (О.Т.К.)' }).click()
    await page.getByRole('button', { name: /\(красный\)/ }).click()
    await page.getByRole('button', { name: 'Подтвердить остановку' }).click()
    await expect(page.getByRole('button', { name: 'Подтвердить результат' })).toBeVisible()
  })

  test('confirmed CTA opens next bout via OPEN_NEXT_BOUT', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const commands: Array<{ url: string; intent?: string }> = []
    const snapshot = buildConfirmedWithNextBoutSnapshot()
    await installMatControlMocks(page, snapshot)
    await page.route('**/api/admin/bouts/*/control/command', async (route) => {
      const body = route.request().postDataJSON() as { intent?: string }
      commands.push({ url: route.request().url(), intent: body.intent })
      await route.fulfill(jsonRoute({ ok: true, liveRevision: 0, boutPhase: 'live' }))
    })

    await page.goto('/admin/bouts/mats/1/control')
    await expect(page.getByText('Поединок завершён')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Перейти к следующему поединку' })).toBeVisible()
    await page.getByRole('button', { name: 'Перейти к следующему поединку' }).click()

    const advance = commands.find((c) => c.intent === 'OPEN_NEXT_BOUT')
    expect(advance).toBeTruthy()
    expect(advance?.url).toMatch(/cat-a(::|%3A%3A)bout-1/)
  })
})

test.describe('judge console layout', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  test.beforeEach(() => {
    test.skip(!process.env.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET is required')
  })

  test('live view keeps +1..+4 buttons in place when disabled', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)
    await installMatControlMocks(
      page,
      buildMatControlSnapshot({ boutPhase: 'live', queueOnly: false }),
    )

    await page.goto('/admin/bouts/mats/1/control')
    const scoreButtons = page.getByRole('button', { name: 'Плюс 1' })
    await expect(scoreButtons).toHaveCount(2)
    const boxBefore = await scoreButtons.first().boundingBox()

    await page.route('**/api/admin/bouts/mats/1/lease/acquire', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Ковёр уже занят другим оператором' }),
      }),
    )
    await page.reload()
    await expect(page.getByTestId('judge-disabled-reason')).toBeVisible()
    await expect(scoreButtons.first()).toBeDisabled()
    const boxAfter = await scoreButtons.first().boundingBox()
    expect(boxBefore?.x).toBe(boxAfter?.x)
    expect(boxBefore?.width).toBe(boxAfter?.width)
  })

  test('prep view shows three-column layout at 1366x768', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)
    await installMatControlMocks(
      page,
      buildMatControlSnapshot({ boutPhase: 'scheduled', queueOnly: false }),
    )

    await page.goto('/admin/bouts/mats/1/control')
    await expect(page.getByText('Красный')).toBeVisible()
    await expect(page.getByText('Ожидание старта')).toBeVisible()
    await expect(page.getByText('Синий')).toBeVisible()
    await expect(page.getByTestId('judge-fight-button')).toBeVisible()
  })

  test('confirmed view shows completion wireframe at 1366x768', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)
    await installMatControlMocks(page, buildConfirmedWithNextBoutSnapshot())

    await page.goto('/admin/bouts/mats/1/control')
    await expect(page.getByText('Поединок завершён')).toBeVisible()
    await expect(page.getByText('Петров Пётр (синий)')).toBeVisible()
    await expect(page.getByText('Б.П. — на ногу · 01:43')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Перейти к следующему поединку' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Порядок поединков' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Оставаться здесь' })).toBeVisible()
  })

  test('125% zoom enables scroll fallback on judge console', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)
    await installMatControlMocks(
      page,
      buildMatControlSnapshot({ boutPhase: 'live', queueOnly: false }),
    )

    await page.goto('/admin/bouts/mats/1/control')
    const main = page.getByTestId('judge-work-scroll')
    await expect(main).toHaveClass(/overflow-y-auto/)

    await page.evaluate(() => {
      const root = document.querySelector('.judge-console')
      if (root instanceof HTMLElement) root.style.zoom = '1.25'
    })

    const metrics = await main.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }))
    expect(metrics.overflowY).toBe('auto')
    expect(metrics.scrollHeight).toBeGreaterThanOrEqual(metrics.clientHeight)

    if (metrics.scrollHeight > metrics.clientHeight) {
      const scrollTop = await main.evaluate((el) => {
        el.scrollTop = el.scrollHeight
        return el.scrollTop
      })
      expect(scrollTop).toBeGreaterThan(0)
    }
  })
})
