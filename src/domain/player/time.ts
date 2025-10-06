import { Clock, Context, Effect, Either, Layer, pipe, Schema } from 'effect'
import { PlayerErrorBuilders, PlayerTimestamp, TimestampSchema } from './index'

export interface PlayerClockService {
  readonly current: Effect.Effect<PlayerTimestamp, ReturnType<typeof PlayerErrorBuilders.clock>>
  readonly fromUnix: (millis: number) => Effect.Effect<PlayerTimestamp, ReturnType<typeof PlayerErrorBuilders.clock>>
}

export const PlayerClock = Context.Tag<PlayerClockService>('@domain/player/clock')

const decodeTimestamp = (value: unknown) =>
  pipe(
    Schema.decodeUnknownEither(TimestampSchema)(value),
    Either.mapLeft((issue) => PlayerErrorBuilders.clock(issue)),
    Effect.fromEither
  )

const makeClock = Effect.succeed<PlayerClockService>({
  current: pipe(Clock.currentTimeMillis, Effect.flatMap(decodeTimestamp)),
  fromUnix: (millis: number) => decodeTimestamp(millis),
})

export const PlayerClockLive = Layer.effect(PlayerClock, makeClock)
