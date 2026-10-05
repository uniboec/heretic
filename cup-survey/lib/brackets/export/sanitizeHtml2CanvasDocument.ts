const INLINE_PROPS = [
  'display',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'width',
  'height',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-radius',
  'outline-width',
  'outline-style',
  'outline-color',
  'box-shadow',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'color',
  'font-size',
  'font-weight',
  'font-family',
  'line-height',
  'letter-spacing',
  'text-align',
  'vertical-align',
  'white-space',
  'overflow',
  'opacity',
  'flex',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'align-items',
  'justify-content',
  'gap',
  'grid-template-columns',
  'grid-template-rows',
  'column-gap',
  'row-gap',
  'transform',
  'z-index',
  'visibility',
] as const

const MODERN_COLOR_PATTERN =
  /color-mix|color\(|oklch|oklab|lab\(|lch\(|hwb\(|light-dark\(/i

function containsModernColorFunction(value: string): boolean {
  return MODERN_COLOR_PATTERN.test(value)
}

function resolveModernColorWithCanvas(sourceView: Window, value: string): string | null {
  try {
    const canvas = sourceView.document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return null

    context.fillStyle = '#000000'
    context.fillStyle = value
    const resolved = context.fillStyle
    if (!resolved || containsModernColorFunction(resolved)) return null
    return resolved
  } catch {
    return null
  }
}

function resolveModernColorWithProbe(
  sourceView: Window,
  property: string,
  value: string,
): string | null {
  const document = sourceView.document
  const probe = document.createElement('div')
  probe.style.setProperty('position', 'fixed', 'important')
  probe.style.setProperty('left', '-10000px', 'important')
  probe.style.setProperty('top', '0', 'important')
  probe.style.setProperty('visibility', 'hidden', 'important')
  probe.style.setProperty('pointer-events', 'none', 'important')
  document.body.appendChild(probe)

  try {
    probe.style.setProperty(property, value)
    const resolved = sourceView.getComputedStyle(probe).getPropertyValue(property)
    if (!resolved || containsModernColorFunction(resolved)) return null
    return resolved
  } catch {
    return null
  } finally {
    probe.remove()
  }
}

function fallbackForColorProperty(property: string): string | null {
  if (property === 'background-color') return '#ffffff'
  if (property === 'background-image' || property === 'box-shadow') return 'none'
  if (property === 'color') return 'rgb(100, 116, 139)'
  if (property.endsWith('-color')) return 'rgb(226, 232, 240)'
  return null
}

function resolveStyleValueForHtml2Canvas(
  sourceView: Window,
  property: string,
  value: string,
): string {
  if (!containsModernColorFunction(value)) {
    return value
  }

  const canvasResolved = resolveModernColorWithCanvas(sourceView, value)
  if (canvasResolved) return canvasResolved

  const probeResolved = resolveModernColorWithProbe(sourceView, property, value)
  if (probeResolved) return probeResolved

  return fallbackForColorProperty(property) ?? value
}

function shouldInlinePropertyValue(property: string, value: string): boolean {
  if (!value) return false
  if (value === 'none' && (property === 'background-image' || property === 'box-shadow')) return false
  if (value === 'auto' && property.includes('margin')) return false
  return true
}

function inlineResolvedStyles(
  target: HTMLElement,
  source: HTMLElement,
  sourceView: Window,
): void {
  if (target.classList.contains('bracket-export-ignore')) {
    target.style.display = 'none'
    return
  }

  const computed = sourceView.getComputedStyle(source)
  for (const prop of INLINE_PROPS) {
    const value = computed.getPropertyValue(prop)
    if (!shouldInlinePropertyValue(prop, value)) continue

    const safeValue = containsModernColorFunction(value)
      ? resolveStyleValueForHtml2Canvas(sourceView, prop, value)
      : value

    if (!shouldInlinePropertyValue(prop, safeValue)) continue
    target.style.setProperty(prop, safeValue)
  }
}

export function inlineComputedStylesForHtml2Canvas(root: HTMLElement, view: Window): void {
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]

  for (const el of elements) {
    inlineResolvedStyles(el, el, view)
  }
}

export function inlineComputedStylesFromSourceTree(
  cloneRoot: HTMLElement,
  sourceRoot: HTMLElement,
  sourceView: Window,
): void {
  const sourceElements = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll<HTMLElement>('*'))]
  const cloneElements = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll<HTMLElement>('*'))]

  for (let index = 0; index < sourceElements.length; index += 1) {
    const source = sourceElements[index]
    const target = cloneElements[index]
    if (!source || !target) continue
    inlineResolvedStyles(target, source, sourceView)
  }
}

export function removeDocumentStylesheets(document: Document): void {
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => node.remove())
}

export function copyThemeVariablesToClone(cloneDocument: Document, sourceView: Window): void {
  const sourceRoot = sourceView.document.documentElement
  const cloneRoot = cloneDocument.documentElement
  const computed = sourceView.getComputedStyle(sourceRoot)

  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index)
    if (!property?.startsWith('--')) continue
    cloneRoot.style.setProperty(property, computed.getPropertyValue(property))
  }
}
