import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

async function main() {
  const docxDir = path.join(process.cwd(), '.preview-brackets/live-docx-full2')
  const xml = readFileSync(path.join(docxDir, 'word/document.xml'), 'utf8')
  const re = /cx="(\d+)" cy="(\d+)"/g
  let match: RegExpExecArray | null
  let i = 0
  while ((match = re.exec(xml)) && i < 12) {
    const w = Math.round((Number(match[1]) / 914400) * 96)
    const h = Math.round((Number(match[2]) / 914400) * 96)
    console.log(`embedded ${++i}: ${w}x${h} (${w > h ? 'landscape' : 'portrait'})`)
  }

  const mediaDir = path.join(docxDir, 'word/media')
  const files = readdirSync(mediaDir).filter((f) => f.endsWith('.png'))
  console.log(`\n${files.length} png files in docx`)

  for (const file of files.slice(0, 8)) {
    const meta = await sharp(path.join(mediaDir, file)).metadata()
    console.log(`${file}: ${meta.width}x${meta.height}`)
  }
}

main().catch(console.error)
