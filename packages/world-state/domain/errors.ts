import { Data } from 'effect'

const formatCause = (cause?: unknown): string =>
  cause instanceof Error ? cause.message : cause ? String(cause) : ''

export class StorageError extends Data.TaggedError('StorageError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    return `Storage operation '${this.operation}' failed${causeMessage ? `: ${causeMessage}` : ''}`
  }
}
