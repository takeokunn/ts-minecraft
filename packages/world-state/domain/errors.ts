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

export class BlockError extends Data.TaggedError('BlockError')<{
  readonly blockType: string
  readonly reason: string
  readonly position?: readonly [number, number, number]
}> {
  override get message(): string {
    const positionStr = this.position
      ? ` at (${this.position[0]}, ${this.position[1]}, ${this.position[2]})`
      : ''
    return `Invalid block operation for type '${this.blockType}'${positionStr}: ${this.reason}`
  }
}
