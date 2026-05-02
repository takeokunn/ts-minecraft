// Domain error types — all extend Data.TaggedError for Effect.catchTag compatibility.
import { Data } from 'effect'

export class InventoryError extends Data.TaggedError('InventoryError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return this.cause
      ? `Inventory error [${this.operation}]: ${String(this.cause)}`
      : `Inventory error [${this.operation}]`
  }
}

export class RecipeError extends Data.TaggedError('RecipeError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return this.cause
      ? `Recipe error [${this.operation}]: ${String(this.cause)}`
      : `Recipe error [${this.operation}]`
  }
}
