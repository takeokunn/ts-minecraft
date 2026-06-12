import { Data } from 'effect'

const formatCause = (cause?: unknown): string =>
  cause instanceof Error ? cause.message : cause ? String(cause) : ''

const withCause = (base: string, cause?: unknown): string => {
  const causeMessage = formatCause(cause)
  return causeMessage ? `${base}: ${causeMessage}` : base
}

export class NetworkError extends Data.TaggedError('NetworkError')<{
  readonly operation: 'serialize' | 'deserialize' | 'start' | 'stop' | 'send' | 'connect' | 'disconnect' | 'receive' | 'capacity' | 'dispatch'
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return withCause(`Network ${this.operation} failed: ${this.reason}`, this.cause)
  }
}
