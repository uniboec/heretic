import { describe, expect, it } from 'vitest'
import {
  chooseLiveSource,
  type GenerationSummary,
} from '../../../scripts/migrate-brackets-single-live'

describe('cutover atomic helpers', () => {
  const draft = {
    id: 'draft-1',
    status: 'DRAFT',
    singletonKey: null,
    categoryCount: 2,
    generatedAt: new Date(),
    publishedAt: null,
  } as unknown as GenerationSummary

  const published = {
    id: 'pub-1',
    status: 'PUBLISHED',
    singletonKey: null,
    categoryCount: 3,
    generatedAt: new Date(),
    publishedAt: new Date(),
  } as unknown as GenerationSummary

  it('prefers PUBLISHED over DRAFT as live source', () => {
    const chosen = chooseLiveSource({ published: published as never, draft: draft as never })
    expect(chosen?.source).toBe('PUBLISHED')
    expect(chosen?.generation.id).toBe('pub-1')
  })

  it('falls back to DRAFT when no published generation', () => {
    const chosen = chooseLiveSource({ published: null, draft: draft as never })
    expect(chosen?.source).toBe('DRAFT')
  })

  it('returns null when no legacy generations', () => {
    expect(chooseLiveSource({ published: null, draft: null })).toBeNull()
  })
})
