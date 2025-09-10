import { Data } from 'effect'

/**
 * Base error class for all domain errors
 * Provides consistent error structure with timestamp tracking
 */
export abstract class DomainError extends Data.TaggedError('DomainError')<{
  readonly message: string
  readonly timestamp: Date
}> {
  constructor(message: string) {
    super({ message, timestamp: new Date() })
  }
}