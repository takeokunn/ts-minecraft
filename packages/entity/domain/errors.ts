// Domain error types — all extend Data.TaggedError for typed Effect.catchTag handling.
import { Data } from 'effect'

// Mirrors the InventoryError tag from the inventory package so InventoryServicePort
// can declare typed errors without a cross-package application import.
export class InventoryError extends Data.TaggedError('InventoryError')<{
  readonly operation: string
  readonly cause?: unknown
}> {}

export class PlayerError extends Data.TaggedError('PlayerError')<{
  readonly playerId: string
  readonly reason: string
}> {
  override get message(): string {
    return `Player error for '${this.playerId}': ${this.reason}`
  }
}

const formatCause = (cause?: unknown): string =>
  cause instanceof Error ? cause.message : cause ? String(cause) : ''

export class CameraError extends Data.TaggedError('CameraError')<{
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    return causeMessage ? `Camera creation failed: ${causeMessage}` : 'Camera creation failed'
  }
}
