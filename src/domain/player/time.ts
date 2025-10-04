import { Context, Effect, Layer, Schema, Either, pipe } from 'effect'
import { PlayerErrorBuilders } from './errors'
import { PlayerTimestamp, TimestampSchema } from './types'

export interface PlayerClockService {
  readonly current: Effect.Effect<PlayerTimestamp, ReturnType<typeof PlayerErrorBuilders.clock>>
  readonly fromUnix: (millis: number) => Effect.Effect<PlayerTimestamp, ReturnType<typeof PlayerErrorBuilders.clock>>
}

export const PlayerClock = Context.GenericTag<PlayerClockService>('@domain/player/clock')

const decodeTimestamp = (value: unknown) =>
  pipe(
    Schema.decodeUnknownEither(TimestampSchema)(value),
    Either.mapLeft((issue) => PlayerErrorBuilders.clock(issue)),
    Effect.fromEither
  )

const makeClock = Effect.succeed<PlayerClockService>({
  current: pipe(
    Effect.sync(() => Date.now()),
    Effect.flatMap(decodeTimestamp)
  ),
  fromUnix: (millis: number) => decodeTimestamp(millis),
})

export const PlayerClockLive = Layer.effect(PlayerClock, makeClock)
