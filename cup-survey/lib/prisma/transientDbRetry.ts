import { Prisma } from '@prisma/client'

export function isTransientPrismaConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P1001' || error.code === 'P1017'
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true
  }

  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("Can't reach database server") ||
    message.includes('Connection terminated') ||
    message.includes('ECONNRESET') ||
    message.includes('connection closed')
  )
}

export async function withTransientDbRetry<T>(
  operation: () => Promise<T>,
  options?: { attempts?: number; delayMs?: number },
): Promise<T> {
  const attempts = options?.attempts ?? 3
  const delayMs = options?.delayMs ?? 150
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isTransientPrismaConnectionError(error) || attempt === attempts - 1) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)))
    }
  }

  throw lastError
}
