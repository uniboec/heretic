import { describe, expect, it } from 'vitest'
import { matControlPath } from '../matControlUrls'

describe('matControlPath', () => {
  it('builds correction deep link', () => {
    expect(matControlPath(2, { boutId: 'cat-a::m1', editResult: true })).toBe(
      '/admin/bouts/mats/2/control?boutId=cat-a%3A%3Am1&editResult=1',
    )
  })
})
