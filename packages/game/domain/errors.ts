import { Data } from 'effect'

const formatCause = (cause?: unknown): string =>
  cause instanceof Error ? cause.message : cause ? String(cause) : ''

const withCause = (base: string, cause?: unknown): string => {
  const causeMessage = formatCause(cause)
  return causeMessage ? `${base}: ${causeMessage}` : base
}

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
    return withCause(`Game loop error: ${this.reason}`, this.cause)
  }
}

export class SettingsError extends Data.TaggedError('SettingsError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return withCause(`Settings ${this.operation} failed`, this.cause)
  }
}

export class StartupError extends Data.TaggedError('StartupError')<{
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return withCause(this.reason, this.cause)
  }
}

export class GameStateError extends Data.TaggedError('GameStateError')<{
  readonly operation: string
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return withCause(`GameState error during ${this.operation}: ${this.reason}`, this.cause)
  }
}
