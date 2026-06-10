import { Data } from 'effect'

const formatCause = (cause?: unknown): string =>
  cause instanceof Error ? cause.message : cause ? String(cause) : ''

export class NetworkError extends Data.TaggedError('NetworkError')<{
  readonly operation: 'serialize' | 'deserialize' | 'start' | 'stop' | 'send' | 'connect' | 'disconnect' | 'receive' | 'capacity' | 'dispatch'
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    return `Network ${this.operation} failed: ${this.reason}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}
