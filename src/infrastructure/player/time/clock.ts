import { PlayerClock, decodeTimestamp, type PlayerClockService } from '@domain/player/time'
import { Clock, Effect, Layer, pipe } from 'effect'

const makeClock = Effect.succeed<PlayerClockService>({
  current: pipe(Clock.currentTimeMillis, Effect.flatMap(decodeTimestamp)),
  fromUnix: (millis: number) => decodeTimestamp(millis),
})

export const PlayerClockLayer = Layer.effect(PlayerClock, makeClock)
