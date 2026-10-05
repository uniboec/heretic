import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { buildBracketWordDocument } from '@/lib/brackets/export/buildBracketWordDocument'
import { BracketExportError } from '@/lib/brackets/export/errors'
import {
  buildBulkExportFilename,
  buildContentDisposition,
  buildSingleCategoryExportFilename,
} from '@/lib/brackets/export/filename'
import { loadBracketExportCategories } from '@/lib/brackets/export/loadExportCategories'
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

export async function GET(request: NextRequest) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const categoryKey = request.nextUrl.searchParams.get('categoryKey')
  const includeTitlePage = request.nextUrl.searchParams.get('includeTitlePage') === '1'

  try {
    const categories = await loadBracketExportCategories(categoryKey)
    const buffer = await buildBracketWordDocument(categories, { includeTitlePage })
    const filename =
      categories.length === 1 && categoryKey
        ? buildSingleCategoryExportFilename(categories[0]!.title)
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
    if (error instanceof BracketExportError) {
      return NextResponse.json(
        { error: error.message, categoryKey: error.categoryKey },
        { status: error.status },
      )
    }
    console.error('[brackets/export/word]', error)
    return NextResponse.json({ error: 'Не удалось сформировать документ' }, { status: 500 })
  }
}
