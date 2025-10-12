/**
 * @fileoverview TestClock/TestRandom/it.effect 使用例
 * @effect/vitestの機能を実証するサンプルテスト
 */

import { describe, expect, it } from '@effect/vitest'
import { Clock, Duration, Effect, Fiber, Match, Random, Schedule, TestClock, pipe } from 'effect'

describe('TestClock Example Tests', () => {
  describe('TestClock - 仮想時間制御', () => {
    it.effect('TestClockは0から開始する', () =>
      Effect.gen(function* () {
        const time = yield* Clock.currentTimeMillis
        expect(time).toBe(0)
      })
    )

    it.effect('TestClock.adjustで仮想時間を進める', () =>
      Effect.gen(function* () {
        const before = yield* Clock.currentTimeMillis
        expect(before).toBe(0)

        // 5秒進める
        yield* TestClock.adjust('5 seconds')
        const after = yield* Clock.currentTimeMillis
        expect(after).toBe(5000)
      })
    )

    it.effect('Effect.sleepと組み合わせて使用', () =>
      Effect.gen(function* () {
        // Effect.sleepを開始（別のFiberで実行）
        const sleepFiber = yield* Effect.fork(Effect.sleep(Duration.seconds(10)))

        // 仮想時間を10秒進める
        yield* TestClock.adjust(Duration.seconds(10))

        // sleepが完了するまで待機
        yield* Fiber.join(sleepFiber)

        const time = yield* Clock.currentTimeMillis
        expect(time).toBe(10000) // 10秒経過
      })
    )

    it.effect('複数回adjustを実行できる', () =>
      Effect.gen(function* () {
        yield* TestClock.adjust('1 second')
        const time1 = yield* Clock.currentTimeMillis
        expect(time1).toBe(1000)

        yield* TestClock.adjust('2 seconds')
        const time2 = yield* Clock.currentTimeMillis
        expect(time2).toBe(3000) // 累積: 1秒 + 2秒

        yield* TestClock.adjust('500 millis')
        const time3 = yield* Clock.currentTimeMillis
        expect(time3).toBe(3500) // 累積: 3秒 + 0.5秒
      })
    )
  })

  describe('TestRandom - 決定的乱数生成', () => {
    it.effect('Random.nextBooleanは決定的な値を返す', () =>
      Effect.gen(function* () {
        const random1 = yield* Random.nextBoolean
        const random2 = yield* Random.nextBoolean

        // TestRandomを使用すると、同じシードで実行される限り同じ結果
        expect(typeof random1).toBe('boolean')
        expect(typeof random2).toBe('boolean')
      })
    )

    it.effect('Random.nextIntRangeで範囲内の整数を取得', () =>
      Effect.gen(function* () {
        const random = yield* Random.nextIntBetween(1, 100)

        expect(random).toBeGreaterThanOrEqual(1)
        expect(random).toBeLessThan(100)
      })
    )

    it.effect('Random.nextで0-1の浮動小数点数を取得', () =>
      Effect.gen(function* () {
        const random = yield* Random.next

        expect(random).toBeGreaterThanOrEqual(0)
        expect(random).toBeLessThan(1)
      })
    )
  })

  describe('it.effect活用例', () => {
    it.effect('通常のitを使わずにEffectをそのまま検証できる', () =>
      Effect.gen(function* () {
        // TestClockが自動適用される
        const time = yield* Clock.currentTimeMillis
        expect(time).toBe(0)
      })
    )

    it.effect('it.effectではyield*で直接実行可能', () =>
      Effect.gen(function* () {
        // TestClockが自動適用される
        const time = yield* Clock.currentTimeMillis
        expect(time).toBe(0) // TestClockは0から開始
      })
    )
  })

  describe('it.live - システムリソース使用', () => {
    it.live('it.liveは実際のシステムクロックを使用', () =>
      Effect.gen(function* () {
        const time = yield* Clock.currentTimeMillis
        // 実時間を取得（TestClockではなくシステムクロック）
        expect(time).toBeGreaterThan(1000000000000) // 2001年以降
      })
    )
  })
})

describe('TestClock 実践的な使用例', () => {
  it.effect('タイムアウト処理のテスト', () =>
    Effect.gen(function* () {
      const operation = Effect.gen(function* () {
        yield* Effect.sleep(Duration.seconds(30))
        return 'completed'
      }).pipe(Effect.timeout(Duration.seconds(10)))

      // operationをForkして実行
      const fiber = yield* Effect.fork(operation)

      // 10秒進める（タイムアウト時間）
      yield* TestClock.adjust(Duration.seconds(10))

      const result = yield* Effect.either(Fiber.join(fiber))

      // タイムアウトで失敗することを確認
      expect(result._tag).toBe('Left')
    })
  )

  it.effect('リトライ処理のテスト', () =>
    Effect.gen(function* () {
      let attempts = 0

      const flakyOperation = Effect.gen(function* () {
        attempts++
        return yield* pipe(
          Match.value(attempts < 3),
          Match.when(true, () => Effect.fail('Not ready' as const)),
          Match.orElse(() => Effect.succeed('success'))
        )
      })

      // Schedule.spacedを使用
      const retriedOperation = flakyOperation.pipe(
        Effect.retry({ schedule: Schedule.spaced(Duration.seconds(1)), times: 5 })
      )

      // リトライをForkして実行
      const fiber = yield* Effect.fork(retriedOperation)

      // リトライ間隔分の時間を進める
      yield* TestClock.adjust(Duration.seconds(3))

      const result = yield* Fiber.join(fiber)

      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })
  )

  it.effect('定期実行のテスト', () =>
    Effect.gen(function* () {
      const results: number[] = []

      const periodicTask = Effect.gen(function* () {
        const time = yield* Clock.currentTimeMillis
        results.push(time)
      })

      // 5秒ごとに3回実行
      const scheduled = periodicTask.pipe(Effect.repeat({ times: 2, schedule: Schedule.spaced(Duration.seconds(5)) }))

      // scheduledをForkして実行
      const fiber = yield* Effect.fork(scheduled)

      // 各実行後に時間を進める
      yield* TestClock.adjust(Duration.seconds(10)) // 合計10秒進める

      yield* Fiber.join(fiber)

      expect(results).toHaveLength(3)
      expect(results[0]).toBe(0)
      expect(results[1]).toBe(5000)
      expect(results[2]).toBe(10000)
    })
  )
})
