/**
 * @fileoverview TestClockを使用した地形生成テスト
 * 仮想時間制御により実時間待機なしでチャンク生成のタイミングをテスト
 */

import { describe, expect, it } from '@effect/vitest'
import { Clock, Duration, Effect, Fiber, Match, ReadonlyArray, TestClock, pipe } from 'effect'

/**
 * チャンク生成のモックEffect
 * 実際の生成処理を模擬し、5秒間の処理時間をシミュレート
 */
const generateChunkMock = (coord: { x: number; z: number }) =>
  Effect.gen(function* () {
    const startTime = yield* Clock.currentTimeMillis

    // 5秒の生成処理をシミュレート
    yield* Effect.sleep(Duration.seconds(5))

    const endTime = yield* Clock.currentTimeMillis

    return {
      coordinate: coord,
      blocks: Array.from({ length: 16 * 16 * 256 }, (_, i) => ({
        type: 'stone' as const,
        position: { x: i % 16, y: Math.floor(i / 256), z: Math.floor((i % 256) / 16) },
      })),
      generated: true,
      generationTime: endTime - startTime,
    }
  })

describe('Terrain Generator with TestClock', () => {
  it.effect('should complete generation within 5 seconds', () =>
    Effect.gen(function* () {
      const startTime = yield* Clock.currentTimeMillis
      expect(startTime).toBe(0) // TestClockは0から開始

      // チャンク生成をフォーク（バックグラウンド実行）
      const chunkFiber = yield* Effect.fork(generateChunkMock({ x: 0, z: 0 }))

      // 仮想時間を5秒進める（実時間は数ミリ秒）
      yield* TestClock.adjust(Duration.seconds(5))

      // チャンク生成完了を待つ
      const result = yield* Fiber.join(chunkFiber)
      const endTime = yield* Clock.currentTimeMillis

      // アサーション
      expect(endTime - startTime).toBe(5000)
      expect(result.generated).toBe(true)
      expect(result.generationTime).toBe(5000)
      expect(result.blocks).toHaveLength(16 * 16 * 256)
      expect(result.coordinate).toEqual({ x: 0, z: 0 })
    })
  )

  it.effect('should generate multiple chunks in parallel', () =>
    Effect.gen(function* () {
      const coordinates = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 },
        { x: 1, z: 1 },
      ]

      // 4つのチャンクを並列生成
      const chunkFibers = yield* Effect.all(
        coordinates.map((coord) => Effect.fork(generateChunkMock(coord))),
        { concurrency: 'unbounded' }
      )

      // 仮想時間を5秒進める（並列実行なので5秒で全て完了）
      yield* TestClock.adjust(Duration.seconds(5))

      // 全チャンクの完了を待つ
      const results = yield* Effect.all(chunkFibers.map(Fiber.join))

      // アサーション
      expect(results).toHaveLength(4)
      expect(results.every((r) => r.generated)).toBe(true)
      expect(results.every((r) => r.generationTime === 5000)).toBe(true)

      // 各チャンクの座標が正しいことを確認
      coordinates.forEach((coord, index) => {
        expect(results[index].coordinate).toEqual(coord)
      })
    })
  )

  it.effect('should handle generation timeout', () =>
    Effect.gen(function* () {
      // 10秒かかる生成に5秒のタイムアウトを設定
      const slowGeneration = Effect.gen(function* () {
        yield* Effect.sleep(Duration.seconds(10))
        return { generated: true }
      }).pipe(Effect.timeout(Duration.seconds(5)))

      const fiber = yield* Effect.fork(slowGeneration)

      // 5秒進める（タイムアウト発生）
      yield* TestClock.adjust(Duration.seconds(5))

      const result = yield* Effect.either(Fiber.join(fiber))

      // タイムアウトでNoneが返る or Leftが返ることを宣言的に検証
      pipe(
        Match.value(result),
        Match.tag('Right', ({ right }) => expect(right._tag).toBe('None')),
        Match.tag('Left', () => expect(result._tag).toBe('Left')),
        Match.exhaustive
      )
    })
  )

  it.effect('should measure generation time accurately', () =>
    Effect.gen(function* () {
      const iterationIndices = ReadonlyArray.fromIterable(Array.from({ length: 3 }, (_, i) => i))

      const measurements = yield* pipe(
        iterationIndices,
        Effect.reduce([] as ReadonlyArray<number>, (acc, index) =>
          Effect.gen(function* () {
            const startTime = yield* Clock.currentTimeMillis
            const fiber = yield* Effect.fork(generateChunkMock({ x: index, z: 0 }))

            yield* TestClock.adjust(Duration.seconds(5))

            const chunk = yield* Fiber.join(fiber)
            const endTime = yield* Clock.currentTimeMillis

            expect(chunk.generationTime).toBe(5000)
            return pipe(acc, ReadonlyArray.append(endTime - startTime))
          })
        )
      )

      // 各生成が正確に5秒かかることを確認
      expect(Array.from(measurements)).toEqual([5000, 5000, 5000])

      // 合計15秒経過していることを確認
      const totalTime = yield* Clock.currentTimeMillis
      expect(totalTime).toBe(15000)
    })
  )
})
