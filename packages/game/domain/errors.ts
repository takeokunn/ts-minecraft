// Domain error types — all extend Data.TaggedError for typed Effect.catchTag handling.
import { Data } from 'effect'

const formatCause = (cause?: unknown): string =>
  cause instanceof Error ? cause.message : cause ? String(cause) : ''

export class WorldError extends Data.TaggedError('WorldError')<{
  readonly worldId: string
  readonly reason: string
  readonly position?: readonly [number, number, number]
}> {
  override get message(): string {
    const positionStr = this.position
      ? ` at (${this.position[0]}, ${this.position[1]}, ${this.position[2]})`
      : ''
    return `World error for '${this.worldId}'${positionStr}: ${this.reason}`
  }
}

export class GameLoopError extends Data.TaggedError('GameLoopError')<{
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    return `Game loop error: ${this.reason}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

export class SettingsError extends Data.TaggedError('SettingsError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    return `Settings ${this.operation} failed${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

export class StartupError extends Data.TaggedError('StartupError')<{
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    return `${this.reason}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

export class GameStateError extends Data.TaggedError('GameStateError')<{
  readonly operation: string
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    return `GameState error during ${this.operation}: ${this.reason}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}
