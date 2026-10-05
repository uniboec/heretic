import { describe, expect, it } from 'vitest'
import { buildBracketWordFromCaptures } from '../buildBracketWordFromCaptures'

const tinyPng = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
)

describe('buildBracketWordFromCaptures', () => {
  it('builds a docx blob from captured bracket images', async () => {
    const blob = await buildBracketWordFromCaptures([
      {
        title: 'Категория A',
        meta: 'TC · 8 участников',
        orientation: 'landscape',
        png: tinyPng,
        width: 1200,
        height: 800,
      },
    ])
    expect(blob.size).toBeGreaterThan(1000)
    expect(blob.type).toContain('wordprocessingml.document')
  })
})
