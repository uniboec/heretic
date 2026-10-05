export const A4_PORTRAIT = { width: 794, height: 1123 }
export const A4_LANDSCAPE = { width: 1123, height: 794 }

/** Matches `@page { margin: 10mm; }` in bracket print styles. */
export const PRINT_PAGE_MARGIN_PX = Math.round((10 / 25.4) * 96)

export function getPrintablePageSize(landscape: boolean): { width: number; height: number } {
  const pageSize = landscape ? A4_LANDSCAPE : A4_PORTRAIT
  return {
    width: pageSize.width - PRINT_PAGE_MARGIN_PX * 2,
    height: pageSize.height - PRINT_PAGE_MARGIN_PX * 2,
  }
}
