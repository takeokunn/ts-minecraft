import { Clock, Effect, Layer } from 'effect'
import { WorldClock } from '@mc/bc-world/domain/time'

/**
 * WorldClock の実運用向け Layer。
 * Effect.Clock から現在時刻を取得し、副作用を Layer に閉じ込める。
 */
export const WorldClockLive = Layer.effect(WorldClock, Effect.succeed({
  currentMillis: Clock.currentTimeMillis,
  currentDate: Effect.map(Clock.currentTimeMillis, (now) => new Date(now)),
}))

/**
 * 任意の時刻を提供するテスト用 Layer。
 */
export const makeWorldClockTestLayer = (fixedMillis: number) =>
  Layer.succeed(WorldClock, {
    currentMillis: Effect.succeed(fixedMillis),
    currentDate: Effect.succeed(new Date(fixedMillis)),
  })
