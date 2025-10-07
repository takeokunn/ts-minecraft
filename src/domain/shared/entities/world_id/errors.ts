import { Data } from 'effect'

/**
 * WorldIdエラー
 */
export class WorldIdError extends Data.TaggedError('WorldIdError')<{
  readonly message: string
  readonly value: string
  readonly cause?: unknown
}> {}
