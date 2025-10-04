import { Schema } from '@effect/schema'
import { Clock, Duration, Effect, Match } from 'effect'
import { ChunkSystemError, EpochMilliseconds, EpochMillisecondsSchema } from './types.js'

const decodeEpoch = (value: number) =>
  Schema.decodeUnknown(EpochMillisecondsSchema)(value).pipe(
    Effect.mapError((issue) =>
      ChunkSystemError.ValidationError({
        message: issue.message,
      })
    )
  )

export const now = () => Clock.currentTimeMillis.pipe(Effect.flatMap(decodeEpoch))

export const withinDeadline = (nowEpoch: EpochMilliseconds, deadline: EpochMilliseconds) =>
  Match.value(nowEpoch <= deadline).pipe(
    Match.when(true, () => Effect.succeed(true)),
    Match.when(false, () => Effect.succeed(false)),
    Match.exhaustive
  )

export const sleepUntil = (deadline: EpochMilliseconds, reference: EpochMilliseconds) => {
  const delta = Math.max(deadline - reference, 0)
  return Match.value(delta).pipe(
    Match.when(0, () => Effect.void),
    Match.orElse(() => Effect.sleep(Duration.millis(delta)))
  )
}
