import { afterEach, describe, expect, it } from 'vitest'
import { absoluteSiteUrl, getSiteUrl } from '../siteUrl'

describe('siteUrl', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('uses NEXT_PUBLIC_SITE_URL for absolute redirects', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://cup26.mma66.ru'
    expect(getSiteUrl()).toBe('https://cup26.mma66.ru')
    expect(absoluteSiteUrl('/admin/bouts/mats/1/control').toString()).toBe(
      'https://cup26.mma66.ru/admin/bouts/mats/1/control',
    )
  })
})
