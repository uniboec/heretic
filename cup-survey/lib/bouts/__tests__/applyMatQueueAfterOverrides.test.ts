import { describe, expect, it } from 'vitest'
import { applyMatQueueAfterOverrides } from '../applyMatQueueAfterOverrides'
import { BoutsValidationError } from '../errors'
import { makeTestBout } from './testBoutHelpers'

describe('applyMatQueueAfterOverrides', () => {
  it('moves postponed bout immediately after anchor', () => {
    const anchor = makeTestBout({ id: 'cat:a::anchor', categoryKey: 'cat:a' })
    const middle = makeTestBout({ id: 'cat:a::middle', categoryKey: 'cat:a' })
    const postponed = makeTestBout({ id: 'cat:a::postponed', categoryKey: 'cat:a' })
    const baseOrder = [postponed, anchor, middle]

    const ordered = applyMatQueueAfterOverrides(baseOrder, {
      'cat:a::postponed': { queueAfterBoutId: 'cat:a::anchor' },
    })

    expect(ordered.map((bout) => bout.id)).toEqual([
      'cat:a::anchor',
      'cat:a::postponed',
      'cat:a::middle',
    ])
  })

  it('keeps relative order among bouts postponed after the same anchor', () => {
    const anchor = makeTestBout({ id: 'cat:a::anchor', categoryKey: 'cat:a' })
    const first = makeTestBout({ id: 'cat:a::first', categoryKey: 'cat:a' })
    const second = makeTestBout({ id: 'cat:a::second', categoryKey: 'cat:a' })
    const tail = makeTestBout({ id: 'cat:a::tail', categoryKey: 'cat:a' })
    const baseOrder = [anchor, first, second, tail]

    const ordered = applyMatQueueAfterOverrides(baseOrder, {
      'cat:a::first': { queueAfterBoutId: 'cat:a::anchor' },
      'cat:a::second': { queueAfterBoutId: 'cat:a::anchor' },
    })

    expect(ordered.map((bout) => bout.id)).toEqual([
      'cat:a::anchor',
      'cat:a::first',
      'cat:a::second',
      'cat:a::tail',
    ])
  })

  it('rejects queue-after cycles', () => {
    const a = makeTestBout({ id: 'cat:a::a', categoryKey: 'cat:a' })
    const b = makeTestBout({ id: 'cat:a::b', categoryKey: 'cat:a' })
    const baseOrder = [a, b]

    expect(() =>
      applyMatQueueAfterOverrides(baseOrder, {
        'cat:a::a': { queueAfterBoutId: 'cat:a::b' },
        'cat:a::b': { queueAfterBoutId: 'cat:a::a' },
      }),
    ).toThrow(BoutsValidationError)
  })
})
