import { Data } from 'effect'

export class FurnaceError extends Data.TaggedError('FurnaceError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return this.cause != null
      ? `Furnace error [${this.operation}]: ${String(this.cause)}`
      : `Furnace error [${this.operation}]`
  }
}
