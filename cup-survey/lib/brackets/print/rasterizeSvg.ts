import sharp from 'sharp'
import { PRINT_DPI_SCALE } from './printTheme'

export async function rasterizeSvg(svg: string, width: number, height: number): Promise<Buffer> {
  const targetWidth = Math.round(width * PRINT_DPI_SCALE)
  const targetHeight = Math.round(height * PRINT_DPI_SCALE)
  return sharp(Buffer.from(svg)).resize(targetWidth, targetHeight).png().toBuffer()
}
