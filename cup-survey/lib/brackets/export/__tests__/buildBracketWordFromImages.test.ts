import { describe, expect, it } from 'vitest'
import { buildBracketWordFromImages } from '../buildBracketWordFromImages'

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

describe('buildBracketWordFromImages', () => {
  it('builds a docx buffer from captured images', async () => {
    const buffer = await buildBracketWordFromImages([
      {
        title: 'Категория A',
        meta: 'TC · 8 участников',
        orientation: 'landscape',
        png: tinyPng,
      },
    ])
    expect(buffer.byteLength).toBeGreaterThan(1000)
  })
})
