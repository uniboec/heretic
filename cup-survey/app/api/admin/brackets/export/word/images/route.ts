import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { buildBracketWordFromImages } from '@/lib/brackets/export/buildBracketWordFromImages'
import { BracketExportError, BracketExportRenderError } from '@/lib/brackets/export/errors'
import {
  buildBulkExportFilename,
  buildContentDisposition,
  buildSingleCategoryExportFilename,
} from '@/lib/brackets/export/filename'
import { TOURNAMENT_TIMEZONE } from '@/lib/config/tournament'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function bulkFilenameDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TOURNAMENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

type WordImagesRequestBody = {
  includeTitlePage?: boolean
  sections?: Array<{
    title: string
    meta: string
    orientation: 'portrait' | 'landscape'
    pngBase64: string
  }>
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as WordImagesRequestBody
    const sections = body.sections ?? []
    if (sections.length === 0) {
      return NextResponse.json({ error: 'Нет сеток для экспорта' }, { status: 400 })
    }

    const buffer = await buildBracketWordFromImages(
      sections.map((section) => ({
        title: section.title,
        meta: section.meta,
        orientation: section.orientation,
        png: Buffer.from(section.pngBase64, 'base64'),
      })),
      { includeTitlePage: body.includeTitlePage },
    )

    const filename =
      sections.length === 1
        ? buildSingleCategoryExportFilename(sections[0]!.title)
        : buildBulkExportFilename(bulkFilenameDate())

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': buildContentDisposition(filename),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof BracketExportError || error instanceof BracketExportRenderError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.error('[brackets/export/word/images]', error)
    return NextResponse.json({ error: 'Не удалось сформировать документ' }, { status: 500 })
  }
}
