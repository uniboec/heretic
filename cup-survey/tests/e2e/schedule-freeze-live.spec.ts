import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import {
  acquireMatControlHolder,
  createMatControlCommandClient,
  ensureScheduleE2EAuth,
  loadScheduleLiveContext,
  patchMatManualOrder,
  prepareNoShowOnRealBout,
  readAdminScheduleVersion,
} from './helpers/scheduleLiveApi'

const LOGIN_SKIP_MESSAGE =
  'Admin auth unavailable (set E2E_ADMIN_PASSWORD in .env or restart dev server with matching ADMIN_SESSION_SECRET)'

test.describe('schedule freeze live API', () => {
  test.beforeEach(() => {
    test.skip(!process.env.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET is required')
  })

  test('rejects direct NO_SHOW when bout is not next startable', async ({ request }) => {
    test.skip(!(await ensureScheduleE2EAuth(request)), LOGIN_SKIP_MESSAGE)

    const context = await loadScheduleLiveContext(request, 1)
    test.skip(!context.ok, context.reason)

    const lease = await acquireMatControlHolder(request, context.matIndex)
    test.skip(!lease.ok, lease.reason)

    const loserEntryId =
      context.notNextStartable.sideA.kind === 'athlete'
        ? context.notNextStartable.sideA.entryId
        : context.notNextStartable.sideB.entryId

    const response = await request.post(
      `/api/admin/bouts/${context.notNextStartable.id}/control/command`,
      {
        data: {
          intent: 'NO_SHOW',
          operationId: randomUUID(),
          holderToken: lease.holderToken,
          expectedLiveRevision: 0,
          expectedAttemptNumber: 1,
          expectedScheduleVersion: context.scheduleVersion,
          payload: { corner: 'red', entryId: loserEntryId },
        },
      },
    )

    expect([409, 422]).toContain(response.status())
    const body = await response.json()
    expect(body.code).toBe('BOUT_NOT_NEXT_IN_SCHEDULE')
  })

  test('allows NO_SHOW after reorder on real API', async ({ request }) => {
    test.skip(!(await ensureScheduleE2EAuth(request)), LOGIN_SKIP_MESSAGE)

    const context = await loadScheduleLiveContext(request, 1)
    test.skip(!context.ok, context.reason)

    const lease = await acquireMatControlHolder(request, context.matIndex)
    test.skip(!lease.ok, lease.reason)

    const reorder = await patchMatManualOrder(request, {
      matIndex: context.matIndex,
      orderedBoutIds: [
        context.notNextStartable.id,
        ...context.allMatBoutIds.filter((id) => id !== context.notNextStartable.id),
      ],
      expectedScheduleVersion: context.scheduleVersion,
    })
    expect(reorder.ok()).toBeTruthy()
    const reorderBody = (await reorder.json()) as { scheduleVersion?: number }
    const scheduleVersionAfterReorder = reorderBody.scheduleVersion ?? context.scheduleVersion

    const liveRevision = await prepareNoShowOnRealBout({
      request,
      bout: context.notNextStartable,
      holderToken: lease.holderToken,
      matIndex: context.matIndex,
      scheduleVersion: scheduleVersionAfterReorder,
      operationPrefix: 'live-reorder-no-show',
    })

    const loserEntryId =
      context.notNextStartable.sideA.kind === 'athlete'
        ? context.notNextStartable.sideA.entryId
        : context.notNextStartable.sideB.entryId

    const noShow = await request.post(
      `/api/admin/bouts/${context.notNextStartable.id}/control/command`,
      {
        data: {
          intent: 'NO_SHOW',
          operationId: randomUUID(),
          holderToken: lease.holderToken,
          expectedLiveRevision: liveRevision,
          expectedAttemptNumber: 1,
          expectedScheduleVersion: scheduleVersionAfterReorder,
          payload: { corner: 'red', entryId: loserEntryId },
        },
      },
    )

    expect(noShow.ok()).toBeTruthy()
    const versionAfter = await readAdminScheduleVersion(request)
    expect(versionAfter).toBeGreaterThanOrEqual(scheduleVersionAfterReorder)
  })

  test('concurrent freeze and reorder expose scheduleVersion', async ({ request }) => {
    test.skip(!(await ensureScheduleE2EAuth(request)), LOGIN_SKIP_MESSAGE)

    const context = await loadScheduleLiveContext(request, 1)
    test.skip(!context.ok, context.reason)

    const lease = await acquireMatControlHolder(request, context.matIndex)
    test.skip(!lease.ok, lease.reason)

    const client = createMatControlCommandClient({
      request,
      boutId: context.nextStartable.id,
      holderToken: lease.holderToken,
    })
    client.setScheduleVersion(context.scheduleVersion)

    const loserEntryId =
      context.nextStartable.sideA.kind === 'athlete'
        ? context.nextStartable.sideA.entryId
        : context.nextStartable.sideB.entryId

    const [freezeResult, reorderResult] = await Promise.all([
      client.send(
        'PENALTY_DISQUALIFY',
        { corner: 'red', entryId: loserEntryId, ladder: 'GENERAL' },
        { operationId: randomUUID(), expectedScheduleVersion: context.scheduleVersion },
      ),
      patchMatManualOrder(request, {
        matIndex: context.matIndex,
        orderedBoutIds: [
          context.notNextStartable.id,
          ...context.allMatBoutIds.filter((id) => id !== context.notNextStartable.id),
        ],
        expectedScheduleVersion: context.scheduleVersion,
      }),
    ])

    const reorderBody = (await reorderResult.json().catch(() => ({}))) as {
      scheduleVersion?: number
      code?: string
    }
    const freezeBody = freezeResult.body

    const reorderHasVersion =
      reorderResult.ok() && typeof reorderBody.scheduleVersion === 'number'
    const reorderConflict = reorderBody.code === 'SCHEDULE_VERSION_CONFLICT'
    const freezeSucceeded = freezeResult.response.ok()
    const freezeConflict =
      freezeBody.code === 'SCHEDULE_VERSION_CONFLICT' ||
      freezeBody.code === 'BOUT_NOT_NEXT_IN_SCHEDULE'

    expect(reorderHasVersion || reorderConflict || freezeSucceeded || freezeConflict).toBe(true)

    const finalVersion = await readAdminScheduleVersion(request)
    expect(finalVersion).toBeGreaterThanOrEqual(context.scheduleVersion)
    if (freezeSucceeded || reorderResult.ok()) {
      expect(finalVersion).toBeGreaterThan(context.scheduleVersion)
    }
  })

  test('matsEnabled toggle bumps scheduleVersion on real API', async ({ request }) => {
    test.skip(!(await ensureScheduleE2EAuth(request)), LOGIN_SKIP_MESSAGE)

    const context = await loadScheduleLiveContext(request, 1)
    test.skip(!context.ok, context.reason)
    test.skip(!context.matsEnabled, 'mats are already disabled')

    const response = await request.patch('/api/admin/bouts/settings', {
      data: {
        matsEnabled: false,
        expectedScheduleVersion: context.scheduleVersion,
      },
    })

    if (!response.ok()) {
      const body = await response.json()
      test.skip(
        body.code === 'SCHEDULE_STRUCTURAL_MUTATION_BLOCKED' ||
          /зафиксированного номера/i.test(body.error ?? ''),
        'matsEnabled toggle blocked by legacy or frozen state',
      )
    }

    expect(response.ok()).toBeTruthy()
    const body = (await response.json()) as { scheduleVersion?: number }
    expect(body.scheduleVersion).toBe(context.scheduleVersion + 1)

    await request.patch('/api/admin/bouts/settings', {
      data: {
        matsEnabled: true,
        expectedScheduleVersion: body.scheduleVersion,
      },
    })
  })
})
