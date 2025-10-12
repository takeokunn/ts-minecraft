import { Context, Effect, Either, Schema, pipe } from 'effect'
import { PlayerErrorBuilders, PlayerTimestamp, TimestampSchema } from './index'

export interface PlayerClockService {
  readonly current: Effect.Effect<PlayerTimestamp, ReturnType<typeof PlayerErrorBuilders.clock>>
  readonly fromUnix: (millis: number) => Effect.Effect<PlayerTimestamp, ReturnType<typeof PlayerErrorBuilders.clock>>
}

export const PlayerClock = Context.Tag<PlayerClockService>('@domain/player/clock')

export const decodeTimestamp = (value: number) =>
  pipe(
    Schema.decodeUnknownEither(TimestampSchema)(value),
    Either.mapLeft((issue) => PlayerErrorBuilders.clock(issue)),
    Effect.fromEither
  )
