import 'server-only'

import type { FileChild } from 'docx'
import type { BracketExportCategory } from './types'
import { BracketExportRenderError } from './errors'
import { renderCategoryPrintPages } from '../print/renderBracketForDocx'

export async function renderCategorySectionChildren(category: BracketExportCategory): Promise<FileChild[]> {
  try {
    return await renderCategoryPrintPages(category)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка рендеринга категории'
    throw new BracketExportRenderError(message, category.categoryKey)
  }
}
