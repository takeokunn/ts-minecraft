// Domain error types — all extend Data.TaggedError for Effect.catchTag compatibility.
import { Data } from 'effect'

export class PlayerError extends Data.TaggedError('PlayerError')<{
  readonly playerId: string
  readonly reason: string
}> {
  override get message(): string {
    return `Player error for '${this.playerId}': ${this.reason}`
  }
}

export class CameraError extends Data.TaggedError('CameraError')<{
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = this.cause instanceof Error ? this.cause.message : this.cause ? String(this.cause) : ''
    return `Camera creation failed${causeMessage ? `: ${causeMessage}` : ''}`
  }
}
