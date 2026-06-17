import { Data } from 'effect'

export class PhysicsServiceError extends Data.TaggedError('PhysicsServiceError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return this.cause
      ? `Physics error [${this.operation}]: ${String(this.cause)}`
      : `Physics error [${this.operation}]`
  }
}
