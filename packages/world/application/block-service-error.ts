import { Data } from 'effect'

const formatCause = (cause?: unknown): string =>
  cause instanceof Error ? cause.message : cause ? String(cause) : ''

export class BlockServiceError extends Data.TaggedError('BlockServiceError')<{
  readonly operation: string
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeStr = formatCause(this.cause)
    return `BlockService error during ${this.operation}: ${this.reason}${causeStr ? `: ${causeStr}` : ''}`
  }
}
