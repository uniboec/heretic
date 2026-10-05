import { expect, test } from '@playwright/test'

test.describe('schedule display numbers', () => {
  test('public bouts payload exposes scheduleDisplayNumber and scheduleVersion', async ({
    request,
  }) => {
    const response = await request.get('/api/tournament/bouts')
    if (response.status() === 404) {
      test.skip()
      return
    }

    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(typeof body.scheduleVersion).toBe('number')
    expect(typeof body.matsEnabled).toBe('boolean')

    const firstBout = body.mats?.[0]?.bouts?.[0]
    if (firstBout) {
      expect(typeof firstBout.scheduleDisplayNumber).toBe('string')
      expect(firstBout.scheduleDisplayNumber.length).toBeGreaterThan(0)
      expect(firstBout.matchNumber).toBeUndefined()
    }
  })
})
