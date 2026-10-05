import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { buildBracketPdfDocument } from '@/lib/brackets/export/buildBracketPdfDocument'
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
    const buffer = await buildBracketPdfDocument(categories, { includeTitlePage })
    const filename =
      categories.length === 1 && categoryKey
        ? buildSingleCategoryExportFilename(categories[0]!.title, 'pdf')
        : buildBulkExportFilename(bulkFilenameDate(), 'pdf')

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
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
    console.error('[brackets/export/pdf]', error)
    return NextResponse.json({ error: 'Не удалось сформировать PDF' }, { status: 500 })
  }
}
