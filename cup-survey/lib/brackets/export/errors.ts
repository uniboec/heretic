export class BracketExportError extends Error {
  readonly status: number
  readonly categoryKey?: string

  constructor(message: string, status: number, categoryKey?: string) {
    super(message)
    this.name = 'BracketExportError'
    this.status = status
    this.categoryKey = categoryKey
  }
}

export class BracketExportRenderError extends BracketExportError {
  constructor(message: string, categoryKey?: string) {
    super(message, 500, categoryKey)
    this.name = 'BracketExportRenderError'
  }
}
