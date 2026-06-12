import { Duration, Effect, Schedule } from 'effect'
import { StorageError } from '../domain/errors'

export const isQuotaExceeded = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'QuotaExceededError'

export const tryCatchStorage = <A>(operation: string, effect: Effect.Effect<A, unknown>): Effect.Effect<A, StorageError> =>
  effect.pipe(
    Effect.mapError((cause) => new StorageError({ operation, cause }))
  )

export const tryCatchStorageWithRetry = <A>(operation: string, effect: Effect.Effect<A, unknown>): Effect.Effect<A, StorageError> =>
  tryCatchStorage(operation, effect).pipe(
    Effect.retry({
      while: (e: StorageError) => !isQuotaExceeded(e.cause),
      times: 3,
      schedule: Schedule.exponential(Duration.millis(100)),
    })
  )
