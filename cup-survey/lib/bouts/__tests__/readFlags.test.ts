import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as publishedDraws from '../../brackets/generation/publishedDraws'
import * as boutsConfig from '../config'
import { getGroupedBoutsForSchedule } from '../schedulePipeline'

describe('bouts read path flags matrix', () => {
  beforeEach(() => {
    vi.spyOn(publishedDraws, 'getActivePublishedGeneration').mockResolvedValue({
      id: 'pub-1',
      publishedAt: new Date(),
    } as never)
    vi.spyOn(publishedDraws, 'getCurrentPublishedDraws').mockResolvedValue([])
    vi.spyOn(publishedDraws, 'getPublicVisiblePublishedDraws').mockResolvedValue([])
    vi.spyOn(publishedDraws, 'getBoutsReleasedPublishedDraws').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Phase 1 reads visible published pairs for public schedule', async () => {
    vi.spyOn(boutsConfig, 'isIndependentBoutsReleaseEnabled').mockReturnValue(false)

    await getGroupedBoutsForSchedule(undefined, 3, { adminPreview: false })

    expect(publishedDraws.getPublicVisiblePublishedDraws).toHaveBeenCalledTimes(1)
    expect(publishedDraws.getBoutsReleasedPublishedDraws).not.toHaveBeenCalled()
  })

  it('Phase 2 reads boutsReleased published pairs for public schedule', async () => {
    vi.spyOn(boutsConfig, 'isIndependentBoutsReleaseEnabled').mockReturnValue(true)

    await getGroupedBoutsForSchedule(undefined, 3, { adminPreview: false })

    expect(publishedDraws.getBoutsReleasedPublishedDraws).toHaveBeenCalledTimes(1)
    expect(publishedDraws.getPublicVisiblePublishedDraws).not.toHaveBeenCalled()
  })
})
