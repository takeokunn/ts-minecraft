/**
 * @fileoverview Game Loop Supervisor - バックグラウンドFiber監視 & FPS計測
 *
 * EXECUTION_4.md T-31に基づく実装：
 * - Supervisor.trackでFiber状態追跡
 * - 周期的なFiber監視ログ出力
 * - 異常Fiber検出とログ出力
 * - FPS/Frame Timeメトリクス計測（T-50）
 *
 * 期待効果:
 * - バックグラウンドFiberの可視化
 * - 失敗Fiberの早期検出
 * - パフォーマンスメトリクス収集
 * - デバッグ性の向上
 */

import { fpsGauge, frameTimeHistogram } from '@application/observability/metrics'
import { Clock, Context, Duration, Effect, Fiber, Layer, Ref, Schedule, Supervisor } from 'effect'

/**
 * GameLoopSupervisor Service
 *
 * バックグラウンドFiberの監視を提供:
 * - start: Fiber監視ループの開始
 */
export interface GameLoopSupervisor {
  /**
   * Fiber監視ループの開始
   *
   * 10秒ごとにFiber状態をログ出力し、異常Fiberを検出
   */
  readonly start: Effect.Effect<void>
}

/**
 * GameLoopSupervisor Service Tag
 */
export const GameLoopSupervisorTag = Context.GenericTag<GameLoopSupervisor>(
  '@minecraft/application/game_loop/GameLoopSupervisor'
)

/**
 * Fiber監視ロジック
 *
 * Supervisor.trackからFiber一覧を取得し、状態をログ出力:
 * - アクティブFiber数
 * - 失敗したFiberの検出とエラーログ
 */
const monitorFibers = (
  supervisor: Supervisor.Supervisor<Array<Fiber.RuntimeFiber<unknown, unknown>>>
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const fibers = yield* supervisor.value
    const count = fibers.length

    yield* Effect.logInfo(`[GameLoopSupervisor] Active fibers: ${count}`)

    // 異常Fiberの検出（Effect.forEachで並列処理）
    yield* Effect.forEach(
      fibers,
      (fiber) =>
        Effect.gen(function* () {
          const status = yield* Fiber.status(fiber)

          // Done状態かつ失敗したFiberをログ出力
          if (status._tag === 'Done') {
            const exit = yield* Fiber.await(fiber)
            if (exit._tag !== 'Success') {
              yield* Effect.logError(`[GameLoopSupervisor] Fiber failed: ${fiber.id()}`)
            }
          }
        }),
      { concurrency: 'unbounded', discard: true }
    )
  })

/**
 * FPS計測ロジック（T-50）
 *
 * 前回フレームとの時間差からFPSとFrame Timeを計測:
 * - FPS: 1秒あたりのフレーム数
 * - Frame Time: 1フレームの処理時間（ms）
 */
const recordFpsMetrics = (lastFrameTimeRef: Ref.Ref<number>): Effect.Effect<void> =>
  Effect.gen(function* () {
    const currentTime = yield* Clock.currentTimeMillis
    const lastFrameTime = yield* Ref.get(lastFrameTimeRef)

    // 初回フレームはスキップ
    if (lastFrameTime === 0) {
      yield* Ref.set(lastFrameTimeRef, currentTime)
      return
    }

    // フレーム時間計算
    const frameTime = currentTime - lastFrameTime
    const fps = frameTime > 0 ? 1000 / frameTime : 0

    // メトリクス記録
    yield* frameTimeHistogram(frameTime)
    yield* fpsGauge.set(fps)

    // 次フレーム用に時刻更新
    yield* Ref.set(lastFrameTimeRef, currentTime)
  })

/**
 * GameLoopSupervisor Live Implementation
 *
 * Supervisor.trackでFiber監視を実装:
 * - 10秒ごとにFiber状態をログ出力（Schedule.spaced）
 * - 約60FPSでFPS/Frame Time計測（T-50）
 * - Layer.scopedで自動リソース管理
 */
export const GameLoopSupervisorLive = Layer.scoped(
  GameLoopSupervisorTag,
  Effect.gen(function* () {
    // Supervisor作成
    const supervisor = yield* Supervisor.track

    // FPS計測用の前回フレーム時刻
    const lastFrameTimeRef = yield* Ref.make<number>(0)

    // Fiber監視ループ（10秒ごと）
    const supervisionLoop = Effect.gen(function* () {
      yield* monitorFibers(supervisor)
    }).pipe(
      Effect.repeat(Schedule.spaced(Duration.seconds(10))),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logWarning(`[GameLoopSupervisor] Monitoring error: ${String(error)}`)
        })
      )
    )

    // FPS計測ループ（約60FPS = 16ms間隔）
    const fpsLoop = Effect.gen(function* () {
      yield* recordFpsMetrics(lastFrameTimeRef)
    }).pipe(
      Effect.repeat(Schedule.spaced(Duration.millis(16))),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logWarning(`[GameLoopSupervisor] FPS metrics error: ${String(error)}`)
        })
      )
    )

    // バックグラウンドFiberを起動
    const monitorFiber = yield* Effect.fork(supervisionLoop)
    const fpsFiber = yield* Effect.fork(fpsLoop)

    // Scope終了時にFiberを中断
    yield* Effect.addFinalizer(() =>
      Effect.all([Fiber.interrupt(monitorFiber), Fiber.interrupt(fpsFiber)], { discard: true })
    )

    return GameLoopSupervisorTag.of({
      start: Effect.void,
    })
  })
)
