import { BracketOperationError, isSerializationFailure } from './errors'

export async function runWithSerializationRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (isSerializationFailure(error) && attempt < maxAttempts - 1) {
        continue
      }
      if (isSerializationFailure(error)) {
        throw new BracketOperationError('CONFLICT', 'Повторите операцию')
      }
      throw error
    }
  }
  throw new BracketOperationError('CONFLICT', 'Повторите операцию')
}
