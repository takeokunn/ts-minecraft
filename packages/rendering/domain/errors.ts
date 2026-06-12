// Domain error types — all extend Data.TaggedError for typed Effect.catchTag handling.
import { Data } from 'effect'

const formatCause = (cause?: unknown): string =>
  /* c8 ignore next */
  cause instanceof Error ? cause.message : cause ? String(cause) : ''

const withCause = (base: string, cause?: unknown): string => {
  const causeMessage = formatCause(cause)
  return causeMessage ? `${base}: ${causeMessage}` : base
}

export class TextureError extends Data.TaggedError('TextureError')<{
  readonly url: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return withCause(`Failed to load texture from ${this.url}`, this.cause)
  }
}

export class MeshError extends Data.TaggedError('MeshError')<{
  readonly reason: string
  readonly cause?: unknown
  readonly details?: string
}> {
  override get message(): string {
    const detailsStr = this.details ? ` (${this.details})` : ''
    return withCause(`Mesh generation failed: ${this.reason}${detailsStr}`, this.cause)
  }
}
