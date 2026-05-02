// Domain error types — all extend Data.TaggedError for Effect.catchTag compatibility.
import { Data } from 'effect'

const formatCause = (cause?: unknown): string =>
  cause instanceof Error ? cause.message : cause ? String(cause) : ''

export class TextureError extends Data.TaggedError('TextureError')<{
  readonly url: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    return `Failed to load texture from ${this.url}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

export class MeshError extends Data.TaggedError('MeshError')<{
  readonly reason: string
  readonly cause?: unknown
  readonly details?: string
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    const detailsStr = this.details ? ` (${this.details})` : ''
    return `Mesh generation failed: ${this.reason}${detailsStr}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}
