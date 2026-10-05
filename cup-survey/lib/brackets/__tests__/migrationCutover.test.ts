import { describe, expect, it } from 'vitest'
import { chooseLiveSource } from '../../../scripts/migrate-brackets-single-live'

describe('migration cutover pointer rebind contract', () => {
  it('chooses published generation before draft for live source', () => {
    const published = {
      id: 'pub',
      status: 'PUBLISHED',
      singletonKey: null,
      baseSeed: 'seed',
      version: 1,
      generatedAt: new Date(),
      publishedAt: new Date(),
      sourceRevision: null,
      sourceFingerprint: null,
      categoryCount: 1,
    } as unknown as import('../../../scripts/migrate-brackets-single-live').GenerationSummary
    const draft = {
      ...published,
      id: 'draft',
      status: 'DRAFT',
      publishedAt: null,
    } as unknown as import('../../../scripts/migrate-brackets-single-live').GenerationSummary

    const chosen = chooseLiveSource({ published: published as never, draft: draft as never })
    expect(chosen?.source).toBe('PUBLISHED')
    expect(chosen?.generation.id).toBe('pub')
  })
})
