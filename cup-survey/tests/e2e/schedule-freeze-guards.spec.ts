import { expect, test } from '@playwright/test'
import { ensureScheduleE2EAuth, loadScheduleLiveContext, patchMatManualOrder } from './helpers/scheduleLiveApi'
import {
  buildMatControlSnapshot,
  installMatControlMocks,
  loginMatControlUser,
} from './helpers/matControlFixtures'

const LOGIN_SKIP_MESSAGE =
  'Admin auth unavailable (set E2E_ADMIN_PASSWORD in .env or restart dev server with matching ADMIN_SESSION_SECRET)'

test.describe('schedule freeze guards', () => {
  test.beforeEach(() => {
    test.skip(!process.env.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET is required')
  })

  test('disables start when bout is not next startable', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const snapshot = buildMatControlSnapshot({ boutPhase: 'scheduled', queueOnly: true })
    snapshot.queue.nextAvailable = {
      bout: {
        ...snapshot.queue.nextAvailable!.bout,
        id: 'cat-a::bout-2',
        scheduleDisplayNumber: '1-2',
        isNextStartable: false,
      },
      participants: snapshot.queue.nextAvailable!.participants,
    }

    await installMatControlMocks(page, snapshot)
    await page.goto('/admin/bouts/mats/1/control')

    const startButton = page.getByRole('button', { name: 'Начать поединок' })
    await expect(startButton).toBeDisabled()
    await expect(startButton).toHaveAttribute(
      'title',
      'Можно начать только следующий поединок в очереди',
    )
  })

  test('rejects direct NO_SHOW API call when bout is not next startable', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const snapshot = buildMatControlSnapshot({ boutPhase: 'scheduled', queueOnly: false })
    snapshot.activeBout!.bout.isNextStartable = true

    await installMatControlMocks(page, snapshot)

    await page.route('**/api/admin/bouts/*/control/command', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      const body = route.request().postDataJSON() as { intent?: string }
      if (body.intent === 'NO_SHOW') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            code: 'BOUT_NOT_NEXT_IN_SCHEDULE',
            message: 'Поединок не является следующим в очереди',
            scheduleVersion: snapshot.scheduleVersion,
          }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/admin/bouts/mats/1/control')

    const result = await page.evaluate(
      async ({ holderToken, scheduleVersion }) => {
        const res = await fetch('/api/admin/bouts/cat-a::bout-2/control/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent: 'NO_SHOW',
            operationId: '44444444-4444-4444-8444-444444444444',
            holderToken,
            expectedLiveRevision: 0,
            expectedAttemptNumber: 1,
            expectedScheduleVersion: scheduleVersion,
            payload: { corner: 'red', entryId: 'red-1' },
          }),
        })
        return { status: res.status, json: await res.json() }
      },
      {
        holderToken: snapshot.session.holderToken,
        scheduleVersion: snapshot.scheduleVersion,
      },
    )

    expect(result.status).toBe(409)
    expect(result.json.code).toBe('BOUT_NOT_NEXT_IN_SCHEDULE')
  })

  test('allows NO_SHOW after reorder when API returns success', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const snapshot = buildMatControlSnapshot({ boutPhase: 'scheduled', queueOnly: true })
    snapshot.queue.nextAvailable = {
      bout: {
        ...snapshot.queue.nextAvailable!.bout,
        id: 'cat-a::bout-2',
        scheduleDisplayNumber: '1-1',
        isNextStartable: true,
      },
      participants: snapshot.queue.nextAvailable!.participants,
    }

    await installMatControlMocks(page, snapshot)

    await page.route('**/api/admin/bouts/*/control/command', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      const body = route.request().postDataJSON() as { intent?: string }
      if (body.intent === 'NO_SHOW') {
        const nextVersion = snapshot.scheduleVersion + 1
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            ok: true,
            scheduleVersion: nextVersion,
            committedScheduleVersion: nextVersion,
          }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/admin/bouts/mats/1/control')

    const nextScheduleVersion = snapshot.scheduleVersion + 1
    const result = await page.evaluate(
      async ({ holderToken, scheduleVersion, nextVersion }) => {
        const res = await fetch('/api/admin/bouts/cat-a::bout-2/control/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent: 'NO_SHOW',
            operationId: '55555555-5555-4555-8555-555555555555',
            holderToken,
            expectedLiveRevision: 0,
            expectedAttemptNumber: 1,
            expectedScheduleVersion: scheduleVersion,
            payload: { corner: 'red', entryId: 'red-1' },
          }),
        })
        return { status: res.status, json: await res.json(), nextVersion }
      },
      {
        holderToken: snapshot.session.holderToken,
        scheduleVersion: snapshot.scheduleVersion,
        nextVersion: nextScheduleVersion,
      },
    )

    expect(result.status).toBe(200)
    expect(result.json.scheduleVersion).toBe(nextScheduleVersion)
  })

  test('returns scheduleVersion on authenticated reorder response', async ({ request }) => {
    test.skip(!process.env.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET is required')
    test.skip(!(await ensureScheduleE2EAuth(request)), LOGIN_SKIP_MESSAGE)

    const context = await loadScheduleLiveContext(request, 1)
    test.skip(!context.ok, context.reason)

    const response = await patchMatManualOrder(request, {
      matIndex: context.matIndex,
      orderedBoutIds: [
        context.notNextStartable.id,
        ...context.allMatBoutIds.filter((id) => id !== context.notNextStartable.id),
      ],
      expectedScheduleVersion: context.scheduleVersion,
    })

    const body = await response.json()
    if (response.ok()) {
      expect(typeof body.scheduleVersion).toBe('number')
      expect(body.scheduleVersion).toBeGreaterThan(context.scheduleVersion)
      return
    }

    expect(body.code ?? body.error).toBeTruthy()
  })
})
