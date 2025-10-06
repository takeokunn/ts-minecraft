import { Clock, Effect, Layer } from 'effect'

/**
 * 固定時刻: 2024-01-01 00:00:00 UTC
 * テストの決定論的実行を保証するための基準時刻
 */
export const FIXED_TEST_TIMESTAMP = 1704067200000

/**
 * テスト用の固定Clock実装
 *
 * 特徴:
 * - currentTimeMillisは常にFIXED_TEST_TIMESTAMPを返す
 * - sleepは即座に完了（時間経過をシミュレートしない）
 * - 決定論的テスト実行を保証
 */
export const TestClockLayer = Layer.succeed(
  Clock.Clock,
  Clock.make({
    currentTimeMillis: Effect.succeed(FIXED_TEST_TIMESTAMP),
    sleep: (_duration) => Effect.unit,
    currentTimeNanos: Effect.succeed(BigInt(FIXED_TEST_TIMESTAMP) * 1000000n),
  })
)

/**
 * カスタマイズ可能なTestClock作成関数
 *
 * @param timestamp - 固定時刻（Unix timestamp ミリ秒）
 * @returns カスタマイズされたTestClockLayer
 *
 * @example
 * ```typescript
 * const customClock = makeTestClockLayer(1609459200000) // 2021-01-01
 * yield* Effect.provide(myEffect, customClock)
 * ```
 */
export const makeTestClockLayer = (timestamp: number) =>
  Layer.succeed(
    Clock.Clock,
    Clock.make({
      currentTimeMillis: Effect.succeed(timestamp),
      sleep: (_duration) => Effect.unit,
      currentTimeNanos: Effect.succeed(BigInt(timestamp) * 1000000n),
    })
  )
