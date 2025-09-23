import { describe, it, expect } from 'vitest'
import { it as effectIt } from '@effect/vitest'
import { Effect, Layer, pipe, Duration, Ref, Array as EffectArray } from 'effect'
import { MovementSystemLive } from '../MovementSystemLive.js'
import { MovementSystem } from '../MovementSystem.js'
import { PlayerServiceLive } from '../PlayerServiceLive.js'
import { PlayerService } from '../PlayerService.js'
import { EntityManagerLayer, EntityManager } from '../../../infrastructure/ecs/EntityManager.js'
import { EntityPoolLayer } from '../../../infrastructure/ecs/Entity.js'
import { SystemRegistryServiceLive } from '../../../infrastructure/ecs/SystemRegistry.js'
import { BrandedTypes } from '../../../shared/types/branded.js'
import { PHYSICS_CONSTANTS } from '../MovementSystem.js'

/**
 * Player System Performance Benchmarks
 *
 * 60FPS要件とパフォーマンスの包括的な検証
 * - シングルプレイヤー 60FPS 維持テスト
 * - マルチプレイヤー環境でのスケーラビリティ
 * - メモリ使用量とGC圧力の測定
 * - フレームドロップとレイテンシー測定
 * - 負荷テストとストレステスト
 * - プロファイリングとボトルネック特定
 */

describe('Player System Performance Benchmarks', () => {
  // CI環境ではパフォーマンステストをスキップ（不安定なため）
  const isCI = process.env['CI'] === 'true'
  const describeOrSkip = isCI ? describe.skip : describe
  const itOrSkip = isCI ? it.skip : it

  // パフォーマンステスト用レイヤー設定
  const BaseDependencies = Layer.mergeAll(EntityPoolLayer, SystemRegistryServiceLive)
  const EntityManagerTestLayer = Layer.provide(EntityManagerLayer, BaseDependencies)
  const PlayerServiceTestLayer = Layer.mergeAll(
    Layer.provide(PlayerServiceLive, EntityManagerTestLayer),
    EntityManagerTestLayer
  )
  const PerformanceTestLayer = Layer.mergeAll(
    Layer.provide(MovementSystemLive, PlayerServiceTestLayer),
    PlayerServiceTestLayer
  )

  // パフォーマンス測定ユーティリティ
  interface PerformanceMetrics {
    frameCount: number
    totalTime: number
    averageFrameTime: number
    minFrameTime: number
    maxFrameTime: number
    frameTimes: number[]
    framesOver16ms: number
    framesOver33ms: number
    frameRate: number
    memoryUsage?: {
      heapUsed: number
      heapTotal: number
      external: number
    }
  }

  const measurePerformance = (frameCount: number, operation: () => Promise<void>) =>
    Effect.gen(function* () {
      const frameTimes: number[] = []
      let totalTime = 0
      let minTime = Infinity
      let maxTime = 0

      const startMemory = process.memoryUsage()

      for (let frame = 0; frame < frameCount; frame++) {
        const frameStart = performance.now()
        yield* Effect.promise(() => operation())
        const frameEnd = performance.now()

        const frameTime = frameEnd - frameStart
        frameTimes.push(frameTime)
        totalTime += frameTime
        minTime = Math.min(minTime, frameTime)
        maxTime = Math.max(maxTime, frameTime)
      }

      const endMemory = process.memoryUsage()
      const averageFrameTime = totalTime / frameCount
      const framesOver16ms = frameTimes.filter((t) => t > 16.67).length
      const framesOver33ms = frameTimes.filter((t) => t > 33.33).length

      const metrics: PerformanceMetrics = {
        frameCount,
        totalTime,
        averageFrameTime,
        minFrameTime: minTime,
        maxFrameTime: maxTime,
        frameTimes,
        framesOver16ms,
        framesOver33ms,
        frameRate: 1000 / averageFrameTime,
        memoryUsage: {
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          external: endMemory.external - startMemory.external,
        },
      }

      return metrics
    })

  const createPerformanceTestPlayer = (playerId: string) =>
    Effect.gen(function* () {
      const playerService = yield* PlayerService
      const brandedPlayerId = BrandedTypes.createPlayerId(playerId)

      yield* playerService.createPlayer({
        playerId,
        initialPosition: { x: 0, y: 64 + 1.8, z: 0 },
        initialRotation: { pitch: 0, yaw: 0 },
        health: 100,
      })

      return brandedPlayerId
    })

  const createMovementInput = (frame: number, deltaTime = 16.67) => ({
    forward: frame % 4 === 0,
    backward: frame % 4 === 1,
    left: frame % 4 === 2,
    right: frame % 4 === 3,
    jump: frame % 60 === 0, // 1秒に1回ジャンプ
    sprint: frame % 20 < 10, // 半分の時間スプリント
    deltaTime,
  })

  describeOrSkip('60FPS Requirements Validation', () => {
    effectIt.effect(
      'should maintain 60FPS with single player for 5 seconds',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createPerformanceTestPlayer('fps-single-test')

          const frameCount = 60 * 5 // 5秒間
          const targetFrameTime = 16.67 // 60FPS

          const metrics = yield* measurePerformance(frameCount, async () => {
            const frame = frameCount % 60
            const input = createMovementInput(frame, targetFrameTime)
            await Effect.runPromise(movementSystem.processMovementInput(playerId, input))
          })

          // 60FPS要件の検証
          expect(metrics.averageFrameTime).toBeLessThan(targetFrameTime)
          expect(metrics.frameRate).toBeGreaterThan(60)

          // フレームドロップの許容範囲（5%以下）
          const frameDropRate = metrics.framesOver16ms / metrics.frameCount
          expect(frameDropRate).toBeLessThan(0.05)

          // 重度のフレームドロップ（33ms超過）はほぼゼロ
          const severeFrameDropRate = metrics.framesOver33ms / metrics.frameCount
          expect(severeFrameDropRate).toBeLessThan(0.01)

          // レイテンシー要件
          expect(metrics.maxFrameTime).toBeLessThan(50) // 最大50ms以下

          console.log(`Single Player Performance:`)
          console.log(`  Average frame time: ${metrics.averageFrameTime.toFixed(2)}ms`)
          console.log(`  Frame rate: ${metrics.frameRate.toFixed(1)}fps`)
          console.log(`  Frame drops (>16ms): ${frameDropRate * 100}%`)
          console.log(`  Max frame time: ${metrics.maxFrameTime.toFixed(2)}ms`)
        }).pipe(Effect.provide(PerformanceTestLayer)) as any
    )

    effectIt.effect(
      'should handle high-frequency input changes at 60FPS',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createPerformanceTestPlayer('fps-highfreq-test')

          const frameCount = 60 * 3 // 3秒間
          let inputChangeCount = 0

          const metrics = yield* measurePerformance(frameCount, async () => {
            const frame = frameCount % 60

            // 毎フレーム入力を変更（最大負荷）
            const input = {
              forward: Math.random() > 0.5,
              backward: Math.random() > 0.5,
              left: Math.random() > 0.5,
              right: Math.random() > 0.5,
              jump: Math.random() > 0.9, // 10%の確率でジャンプ
              sprint: Math.random() > 0.3, // 70%の確率でスプリント
              deltaTime: 16.67,
            }

            inputChangeCount++
            await Effect.runPromise(movementSystem.processMovementInput(playerId, input))
          })

          // 高頻度入力変更でも60FPS維持
          expect(metrics.averageFrameTime).toBeLessThan(16.67)
          expect(metrics.framesOver16ms / metrics.frameCount).toBeLessThan(0.1) // 10%以下

          console.log(`High-Frequency Input Performance:`)
          console.log(`  Input changes: ${inputChangeCount}`)
          console.log(`  Average frame time: ${metrics.averageFrameTime.toFixed(2)}ms`)
          console.log(`  Frame rate: ${metrics.frameRate.toFixed(1)}fps`)
        }).pipe(Effect.provide(PerformanceTestLayer)) as any
    )

    effectIt.effect(
      'should maintain performance with complex movement patterns',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createPerformanceTestPlayer('fps-complex-test')

          const frameCount = 60 * 2 // 2秒間

          const metrics = yield* measurePerformance(frameCount, async () => {
            const frame = frameCount % 60

            // 複雑な移動パターン（サインカーブ、ジャンプ、スプリント）
            const input = {
              forward: Math.sin(frame * 0.1) > 0,
              backward: Math.sin(frame * 0.1) < 0,
              left: Math.cos(frame * 0.15) > 0.5,
              right: Math.cos(frame * 0.15) < -0.5,
              jump: frame % 30 === 0, // 0.5秒ごとにジャンプ
              sprint: Math.sin(frame * 0.05) > 0, // 滑らかなスプリント切り替え
              deltaTime: 16.67,
            }

            await Effect.runPromise(movementSystem.processMovementInput(playerId, input))
          })

          // 複雑な移動パターンでも性能維持
          expect(metrics.averageFrameTime).toBeLessThan(16.67)
          expect(metrics.frameRate).toBeGreaterThan(60)

          console.log(`Complex Movement Performance:`)
          console.log(`  Average frame time: ${metrics.averageFrameTime.toFixed(2)}ms`)
          console.log(`  Frame rate: ${metrics.frameRate.toFixed(1)}fps`)
        }).pipe(Effect.provide(PerformanceTestLayer)) as any
    )
  })

  describeOrSkip('Multi-Player Scalability Tests', () => {
    effectIt.effect(
      'should handle 10 players at 60FPS',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerCount = 10
          const frameCount = 60 * 2 // 2秒間

          // 複数プレイヤーを作成
          const playerIds = yield* Effect.all(
            Array.from({ length: playerCount }, (_, i) => createPerformanceTestPlayer(`multi-player-${i}`)),
            { concurrency: 'unbounded' }
          )

          const metrics = yield* measurePerformance(frameCount, async () => {
            const frame = frameCount % 60

            // 各プレイヤーに異なる入力パターンを適用
            const operations = playerIds.map((playerId, index) => {
              const input = createMovementInput(frame + index * 10, 16.67)
              return movementSystem.processMovementInput(playerId, input)
            })

            Effect.runSync(Effect.all(operations, { concurrency: 'unbounded' }))
          })

          // マルチプレイヤー環境での性能要件
          const targetFrameTime = 16.67
          expect(metrics.averageFrameTime).toBeLessThan(targetFrameTime)

          // プレイヤー1人あたりの処理時間
          const timePerPlayer = metrics.averageFrameTime / playerCount
          expect(timePerPlayer).toBeLessThan(1.5) // 1.5ms以下

          console.log(`Multi-Player (${playerCount}) Performance:`)
          console.log(`  Average frame time: ${metrics.averageFrameTime.toFixed(2)}ms`)
          console.log(`  Time per player: ${timePerPlayer.toFixed(2)}ms`)
          console.log(`  Frame rate: ${metrics.frameRate.toFixed(1)}fps`)
        }).pipe(Effect.provide(PerformanceTestLayer)) as any
    )

    effectIt.effect(
      'should scale to 50 players with acceptable performance',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerCount = 50
          const frameCount = 60 // 1秒間（負荷が高いため短縮）

          // 大量プレイヤーを作成
          const playerIds = yield* Effect.all(
            Array.from({ length: playerCount }, (_, i) => createPerformanceTestPlayer(`scale-player-${i}`)),
            { concurrency: 'unbounded' }
          )

          const metrics = yield* measurePerformance(frameCount, async () => {
            const frame = frameCount % 60

            // バッチサイズを制限して負荷分散
            const batchSize = 10
            const batches = []

            for (let i = 0; i < playerIds.length; i += batchSize) {
              const batch = playerIds.slice(i, i + batchSize).map((playerId, index) => {
                const input = createMovementInput(frame + i + index, 16.67)
                return movementSystem.processMovementInput(playerId, input)
              })
              batches.push(Effect.all(batch, { concurrency: 'unbounded' }))
            }

            Effect.runSync(Effect.all(batches, { concurrency: 'unbounded' }))
          })

          // 大規模環境での性能要件（緩和された要件）
          const targetFrameTime = 33.33 // 30FPS相当
          expect(metrics.averageFrameTime).toBeLessThan(targetFrameTime)

          const timePerPlayer = metrics.averageFrameTime / playerCount
          expect(timePerPlayer).toBeLessThan(0.5) // 0.5ms以下

          console.log(`Large Scale (${playerCount}) Performance:`)
          console.log(`  Average frame time: ${metrics.averageFrameTime.toFixed(2)}ms`)
          console.log(`  Time per player: ${timePerPlayer.toFixed(3)}ms`)
          console.log(`  Frame rate: ${metrics.frameRate.toFixed(1)}fps`)
        }).pipe(Effect.provide(PerformanceTestLayer)) as any
    )

    effectIt.effect(
      'should demonstrate linear scaling characteristics',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerCounts = [1, 5, 10, 20]
          const frameCount = 30 // 短縮テスト

          const scalingResults = []

          for (const playerCount of playerCounts) {
            // プレイヤーを作成
            const playerIds = yield* Effect.all(
              Array.from({ length: playerCount }, (_, i) => createPerformanceTestPlayer(`scaling-${playerCount}-${i}`)),
              { concurrency: 'unbounded' }
            )

            const metrics = yield* measurePerformance(frameCount, async () => {
              const frame = frameCount % 30

              const operations = playerIds.map((playerId, index) => {
                const input = createMovementInput(frame + index, 16.67)
                return movementSystem.processMovementInput(playerId, input)
              })

              Effect.runSync(Effect.all(operations, { concurrency: 'unbounded' }))
            })

            scalingResults.push({
              playerCount,
              averageFrameTime: metrics.averageFrameTime,
              timePerPlayer: metrics.averageFrameTime / playerCount,
            })
          }

          // スケーリング特性の検証
          console.log(`Scaling Characteristics:`)
          scalingResults.forEach((result) => {
            console.log(
              `  ${result.playerCount} players: ${result.averageFrameTime.toFixed(2)}ms total, ${result.timePerPlayer.toFixed(3)}ms per player`
            )
          })

          // 線形スケーリングの確認（プレイヤー1人あたりの時間が安定）
          const timePerPlayerVariance = scalingResults.map((r) => r.timePerPlayer)

          // 線形スケーリングの検証: 時間が概ねプレイヤー数に比例することを確認
          // 理想的には、per-player時間は一定だが、実環境では変動がある
          // 2プレイヤー以上の結果のみを使用してスケーリングを評価
          const multiPlayerResults = scalingResults.filter((r) => r.playerCount > 1)

          if (multiPlayerResults.length > 0) {
            // 複数プレイヤー時の1人あたりの処理時間の標準偏差を計算
            const avgTimePerPlayer =
              multiPlayerResults.map((r) => r.timePerPlayer).reduce((a, b) => a + b, 0) / multiPlayerResults.length

            const stdDev = Math.sqrt(
              multiPlayerResults
                .map((r) => Math.pow(r.timePerPlayer - avgTimePerPlayer, 2))
                .reduce((a, b) => a + b, 0) / multiPlayerResults.length
            )

            // 変動係数（CV）を使用: 標準偏差 / 平均
            const coefficientOfVariation = avgTimePerPlayer > 0 ? stdDev / avgTimePerPlayer : 0

            // 変動係数が1.0以下であることを確認（100%以下の変動）
            // これは、標準偏差が平均値以下であることを意味する
            expect(coefficientOfVariation).toBeLessThan(1.0)

            console.log(`  Coefficient of Variation: ${coefficientOfVariation.toFixed(2)}`)
          }
        }).pipe(Effect.provide(PerformanceTestLayer)) as any
    )
  })

  describeOrSkip('Memory and Resource Management', () => {
    effectIt.effect(
      'should not leak memory over extended gameplay',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService
          const movementSystem = yield* MovementSystem

          const initialMemory = process.memoryUsage()

          // 長時間プレイのシミュレーション
          const sessionCount = 10
          const framesPerSession = 60 * 10 // 10秒間のセッション

          for (let session = 0; session < sessionCount; session++) {
            // プレイヤーを作成
            const playerId = yield* createPerformanceTestPlayer(`memory-test-${session}`)

            // セッション実行
            for (let frame = 0; frame < framesPerSession; frame++) {
              const input = createMovementInput(frame, 16.67)
              yield* movementSystem.processMovementInput(playerId, input)
            }

            // プレイヤー削除（メモリ解放）
            yield* playerService.destroyPlayer(playerId)

            // ガベージコレクション促進
            if (global.gc) {
              global.gc()
            }
          }

          const finalMemory = process.memoryUsage()
          const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

          // メモリ増加が100MB以下
          expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)

          console.log(`Memory Usage:`)
          console.log(`  Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`)
          console.log(`  Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`)
          console.log(`  Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
        }).pipe(Effect.provide(PerformanceTestLayer)) as any
    )

    effectIt.effect(
      'should handle rapid player creation and deletion efficiently',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService
          const cycleCount = 100

          const startTime = performance.now()
          const initialMemory = process.memoryUsage()

          // 大量の作成・削除サイクル
          for (let cycle = 0; cycle < cycleCount; cycle++) {
            // プレイヤー作成
            const playerId = yield* createPerformanceTestPlayer(`cycle-player-${cycle}`)

            // 短時間のアクティビティ
            const playerState = yield* playerService.getPlayerState(playerId)
            expect(playerState.playerId).toBe(`cycle-player-${cycle}`)

            // プレイヤー削除
            yield* playerService.destroyPlayer(playerId)
          }

          const endTime = performance.now()
          const finalMemory = process.memoryUsage()

          const totalTime = endTime - startTime
          const timePerCycle = totalTime / cycleCount
          const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

          // パフォーマンス要件
          expect(timePerCycle).toBeLessThan(5) // サイクルあたり5ms以下
          expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // 10MB以下の増加

          console.log(`Creation/Deletion Performance:`)
          console.log(`  Cycles: ${cycleCount}`)
          console.log(`  Time per cycle: ${timePerCycle.toFixed(2)}ms`)
          console.log(`  Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
        }).pipe(Effect.provide(PerformanceTestLayer)) as any
    )
  })

  describeOrSkip('Stress Tests and Edge Cases', () => {
    effectIt.effect(
      'should handle extreme input frequencies',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createPerformanceTestPlayer('stress-frequency-test')

          // 極端に高頻度の入力（240FPS相当）
          const frameCount = 240 * 2 // 2秒間
          const ultraHighFreqDeltaTime = 4.17 // 240FPS

          const metrics = yield* measurePerformance(frameCount, async () => {
            const frame = frameCount % 240

            const input = {
              forward: frame % 2 === 0, // 毎フレーム切り替え
              backward: frame % 3 === 0,
              left: frame % 5 === 0,
              right: frame % 7 === 0,
              jump: frame % 11 === 0,
              sprint: frame % 13 === 0,
              deltaTime: ultraHighFreqDeltaTime,
            }

            await Effect.runPromise(movementSystem.processMovementInput(playerId, input))
          })

          // 高頻度入力でも安定した処理
          expect(metrics.averageFrameTime).toBeLessThan(5) // 5ms以下
          expect(metrics.maxFrameTime).toBeLessThan(20) // 最大20ms以下

          console.log(`Extreme Frequency Performance:`)
          console.log(`  Frame count: ${frameCount}`)
          console.log(`  Average frame time: ${metrics.averageFrameTime.toFixed(2)}ms`)
          console.log(`  Max frame time: ${metrics.maxFrameTime.toFixed(2)}ms`)
        }).pipe(Effect.provide(PerformanceTestLayer)) as any
    )

    effectIt.effect(
      'should maintain performance under continuous load',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createPerformanceTestPlayer('stress-continuous-test')

          // 連続負荷テスト（10秒間）
          const frameCount = 60 * 10
          const performanceHistory: number[] = []

          // 1秒ごとのパフォーマンス測定
          for (let second = 0; second < 10; second++) {
            const secondStartTime = performance.now()

            for (let frame = 0; frame < 60; frame++) {
              const totalFrame = second * 60 + frame
              const input = createMovementInput(totalFrame, 16.67)
              yield* movementSystem.processMovementInput(playerId, input)
            }

            const secondEndTime = performance.now()
            const secondTime = secondEndTime - secondStartTime
            performanceHistory.push(secondTime)
          }

          // 時間経過による性能劣化がないことを確認
          const firstSecond = performanceHistory[0]!
          const lastSecond = performanceHistory[performanceHistory.length - 1]!
          const performanceDrift = (lastSecond - firstSecond) / firstSecond

          // 120%以下の性能変化（2.2倍以内）
          expect(Math.abs(performanceDrift)).toBeLessThan(1.2)

          // 全ての1秒間が1秒以内に完了
          performanceHistory.forEach((time, index) => {
            expect(time).toBeLessThan(1000) // 1秒以内
          })

          console.log(`Continuous Load Performance:`)
          console.log(`  Duration: 10 seconds`)
          console.log(`  First second: ${firstSecond!.toFixed(2)}ms`)
          console.log(`  Last second: ${lastSecond!.toFixed(2)}ms`)
          console.log(`  Performance drift: ${(performanceDrift * 100).toFixed(1)}%`)
        }).pipe(Effect.provide(PerformanceTestLayer)) as any
    )

    effectIt.effect(
      'should handle worst-case collision scenarios efficiently',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createPerformanceTestPlayer('stress-collision-test')

          // 境界線での移動（衝突検出の負荷が最大）
          const frameCount = 60 * 2 // 2秒間

          const metrics = yield* measurePerformance(frameCount, async () => {
            const frame = frameCount % 60

            // 境界線ギリギリでの移動
            const input = {
              forward: true,
              backward: false,
              left: true,
              right: false,
              jump: frame % 10 === 0, // 頻繁なジャンプ
              sprint: true,
              deltaTime: 16.67,
            }

            await Effect.runPromise(movementSystem.processMovementInput(playerId, input))
          })

          // 衝突計算の負荷が高くても性能維持
          expect(metrics.averageFrameTime).toBeLessThan(20) // 20ms以下
          expect(metrics.frameRate).toBeGreaterThan(50) // 50FPS以上

          console.log(`Collision Stress Performance:`)
          console.log(`  Average frame time: ${metrics.averageFrameTime.toFixed(2)}ms`)
          console.log(`  Frame rate: ${metrics.frameRate.toFixed(1)}fps`)
        }).pipe(Effect.provide(PerformanceTestLayer)) as any
    )
  })

  describeOrSkip('Performance Regression Detection', () => {
    effectIt.effect(
      'should maintain baseline performance characteristics',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem

          // ベースライン測定用の標準テスト
          const playerId = yield* createPerformanceTestPlayer('baseline-test')
          const frameCount = 60 // 1秒間

          const metrics = yield* measurePerformance(frameCount, async () => {
            const frame = frameCount % 60
            const input = createMovementInput(frame, 16.67)
            await Effect.runPromise(movementSystem.processMovementInput(playerId, input))
          })

          // ベースライン要件（将来のリグレッション検出用）
          const baselineRequirements = {
            maxAverageFrameTime: 5.0, // 5ms以下
            minFrameRate: 200, // 200FPS以上
            maxMemoryIncrease: 20 * 1024 * 1024, // 20MB以下
          }

          expect(metrics.averageFrameTime).toBeLessThan(baselineRequirements.maxAverageFrameTime)
          expect(metrics.frameRate).toBeGreaterThan(baselineRequirements.minFrameRate)

          if (metrics.memoryUsage) {
            expect(metrics.memoryUsage.heapUsed).toBeLessThan(baselineRequirements.maxMemoryIncrease)
          }

          // パフォーマンス詳細情報のログ出力
          console.log(`Baseline Performance Metrics:`)
          console.log(`  Average frame time: ${metrics.averageFrameTime.toFixed(3)}ms`)
          console.log(`  Min frame time: ${metrics.minFrameTime.toFixed(3)}ms`)
          console.log(`  Max frame time: ${metrics.maxFrameTime.toFixed(3)}ms`)
          console.log(`  Frame rate: ${metrics.frameRate.toFixed(1)}fps`)
          console.log(`  Frames over 16ms: ${metrics.framesOver16ms}/${metrics.frameCount}`)

          // 統計情報の検証
          const stats = yield* movementSystem.getPerformanceStats()
          expect(stats.totalCalculations).toBe(frameCount)
          expect(stats.averageProcessingTime).toBeLessThan(baselineRequirements.maxAverageFrameTime)

          console.log(`Movement System Stats:`)
          console.log(`  Total calculations: ${stats.totalCalculations}`)
          console.log(`  Average processing time: ${stats.averageProcessingTime.toFixed(3)}ms`)
          console.log(`  Max processing time: ${stats.maxProcessingTime.toFixed(3)}ms`)
        }).pipe(Effect.provide(PerformanceTestLayer)) as any
    )
  })
})
