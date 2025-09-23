import { Effect, Exit, Layer, Option, pipe, Ref, Schedule, Stream, Match, Duration } from 'effect'
import { GameLoopService } from './GameLoopService'
import type { FrameInfo, GameLoopConfig, PerformanceMetrics } from './types'
import type { GameLoopState } from './types'
import { DEFAULT_GAME_LOOP_CONFIG } from './types'
import { GameLoopInitError, GameLoopPerformanceError, GameLoopRuntimeError, GameLoopStateError } from './errors'

interface GameLoopInternalState {
  state: GameLoopState
  config: GameLoopConfig
  frameCount: number
  lastFrameTime: number
  animationFrameId: number | null
  frameCallbacks: Array<(frameInfo: FrameInfo) => Effect.Effect<void>>
  performanceBuffer: number[]
  droppedFrames: number
  totalFrames: number
}

// GameLoopServiceのLive実装
export const GameLoopServiceLive = Layer.effect(
  GameLoopService,
  Effect.gen(function* () {
    // 内部状態の管理
    const internalState = yield* Ref.make<GameLoopInternalState>({
      state: 'idle',
      config: DEFAULT_GAME_LOOP_CONFIG,
      frameCount: 0,
      lastFrameTime: 0,
      animationFrameId: null,
      frameCallbacks: [],
      performanceBuffer: [],
      droppedFrames: 0,
      totalFrames: 0,
    })

    // フレーム実行ロジック（再帰を制御）
    const executeFrame = (timestamp: number) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(internalState)

        // Match.valueパターンを使用して状態チェック
        const shouldContinue = pipe(
          state.state,
          Match.value,
          Match.when('running', () => true),
          Match.orElse(() => false)
        )

        if (!shouldContinue) {
          return
        }

        const deltaTime = state.lastFrameTime ? timestamp - state.lastFrameTime : 0
        const targetFrameTime = 1000 / state.config.targetFps

        // フレームスキップの判定
        const frameSkipped = deltaTime > targetFrameTime * state.config.maxFrameSkip

        if (frameSkipped) {
          yield* Ref.update(internalState, (s) => ({
            ...s,
            droppedFrames: s.droppedFrames + 1,
          }))
        }

        const fps = deltaTime > 0 ? 1000 / deltaTime : state.config.targetFps

        // フレーム情報の作成
        const frameInfo: FrameInfo = {
          currentTime: timestamp,
          deltaTime: Math.min(deltaTime, targetFrameTime * 2), // デルタタイムの上限設定
          frameCount: state.frameCount,
          fps,
          frameSkipped,
        }

        // コールバックの実行
        yield* Effect.all(
          state.frameCallbacks.map((callback) =>
            Effect.catchAll(callback(frameInfo), (error) =>
              Effect.sync(() => {
                console.error('Frame callback error:', error)
              })
            )
          ),
          { concurrency: 'unbounded' }
        )

        // パフォーマンスメトリクスの更新
        const updatedBuffer = [...state.performanceBuffer, fps].slice(-60) // 直近60フレーム分を保持

        // 状態の更新
        yield* Ref.update(internalState, (s) => ({
          ...s,
          frameCount: s.frameCount + 1,
          lastFrameTime: timestamp,
          performanceBuffer: updatedBuffer,
          totalFrames: s.totalFrames + 1,
        }))
      })

    // 安全なフレームスケジューリング（タイムアウト付き）
    const scheduleNextFrame = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(internalState)

        // 状態が'running'でない場合は何もしない
        if (state.state !== 'running') {
          return
        }

        // タイムアウト付きで単一フレームを実行（再帰を防ぐ）
        yield* Effect.race(
          Effect.async<void, never, never>((resume) => {
            const nextFrameId = requestAnimationFrame((ts) => {
              // フレーム処理のみを実行（再帰呼び出しを削除）
              Effect.runFork(
                executeFrame(ts).pipe(
                  Effect.catchAll((error) =>
                    Effect.sync(() => {
                      console.error('Frame execution failed:', error)
                    })
                  )
                )
              )
              resume(Effect.succeed(undefined))
            })

            // animationFrameIdの更新をリソース取得として管理
            Effect.runFork(
              Ref.update(internalState, (s) => ({
                ...s,
                animationFrameId: nextFrameId,
              }))
            )

            return Effect.sync(() => cancelAnimationFrame(nextFrameId))
          }),
          Effect.sleep(Duration.millis(50)) // タイムアウト50msに短縮
        ).pipe(
          Effect.catchAll(() => Effect.void) // タイムアウト時は無視
        )
      })

    return GameLoopService.of({
      initialize: (config) =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          // Match.valueパターンを使用して状態チェック
          const initResult = pipe(
            currentState.state,
            Match.value,
            Match.when('idle', () => ({ canInit: true }) as const),
            Match.when('stopped', () => ({ canInit: true }) as const),
            Match.orElse(
              (state) =>
                ({
                  canInit: false,
                  error: {
                    _tag: 'GameLoopInitError' as const,
                    message: 'GameLoop is already initialized',
                    reason: `Current state is ${state}`,
                  } satisfies GameLoopInitError,
                }) as const
            )
          )

          if (!initResult.canInit) {
            return yield* Effect.fail((initResult as any).error)
          }

          const mergedConfig = { ...DEFAULT_GAME_LOOP_CONFIG, ...config }

          yield* Ref.update(internalState, (s) => ({
            ...s,
            config: mergedConfig,
            state: 'idle' as GameLoopState,
            frameCount: 0,
            lastFrameTime: 0,
            performanceBuffer: [],
            droppedFrames: 0,
            totalFrames: 0,
          }))
        }),

      start: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          // Match.valueパターンを使用して状態遷移チェック
          const startResult = pipe(
            currentState.state,
            Match.value,
            Match.when('running', () => ({ canStart: true, shouldSkip: true }) as const),
            Match.when('idle', () => ({ canStart: true, shouldSkip: false }) as const),
            Match.when('paused', () => ({ canStart: true, shouldSkip: false }) as const),
            Match.orElse(
              (state) =>
                ({
                  canStart: false,
                  error: {
                    _tag: 'GameLoopStateError' as const,
                    message: 'Invalid state transition',
                    currentState: state,
                    attemptedTransition: 'start',
                  } satisfies GameLoopStateError,
                }) as const
            )
          )

          if (!startResult.canStart) {
            return yield* Effect.fail((startResult as any).error)
          }

          if ('shouldSkip' in startResult && startResult.shouldSkip) {
            return
          }

          // 原子的な状態更新
          yield* Ref.update(internalState, (s) => ({
            ...s,
            state: 'running' as GameLoopState,
            lastFrameTime: performance.now(),
          }))

          // 単一フレームをスケジュール（連続実行はしない）
          yield* Effect.race(
            Effect.async<void, never, never>((resume) => {
              const frameId = requestAnimationFrame((timestamp) => {
                Effect.runFork(
                  executeFrame(timestamp).pipe(
                    Effect.catchAll((error) =>
                      Effect.sync(() => {
                        console.error('Frame execution failed:', error)
                      })
                    )
                  )
                )
                resume(Effect.succeed(undefined))
              })

              // animationFrameIdの更新
              Effect.runFork(
                Ref.update(internalState, (s) => ({
                  ...s,
                  animationFrameId: frameId,
                }))
              )

              return Effect.sync(() => cancelAnimationFrame(frameId))
            }),
            Effect.sleep(Duration.millis(100)) // タイムアウト保護
          ).pipe(Effect.catchAll(() => Effect.void))
        }),

      pause: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          // Match.valueパターンを使用して状態チェック
          const pauseResult = pipe(
            currentState.state,
            Match.value,
            Match.when('running', () => ({ canPause: true }) as const),
            Match.orElse(
              (state) =>
                ({
                  canPause: false,
                  error: {
                    _tag: 'GameLoopStateError' as const,
                    message: 'Can only pause when running',
                    currentState: state,
                    attemptedTransition: 'pause',
                  } satisfies GameLoopStateError,
                }) as const
            )
          )

          if (!pauseResult.canPause) {
            return yield* Effect.fail((pauseResult as any).error)
          }

          // アニメーションフレームのキャンセル
          yield* pipe(
            Option.fromNullable(currentState.animationFrameId),
            Option.match({
              onNone: () => Effect.void,
              onSome: (frameId) => Effect.sync(() => cancelAnimationFrame(frameId)),
            })
          )

          // 原子的な状態更新
          yield* Ref.update(internalState, (s) => ({
            ...s,
            state: 'paused' as GameLoopState,
            animationFrameId: null,
          }))
        }),

      resume: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          // Match.valueパターンを使用して状態チェック
          const resumeResult = pipe(
            currentState.state,
            Match.value,
            Match.when('paused', () => ({ canResume: true }) as const),
            Match.orElse(
              (state) =>
                ({
                  canResume: false,
                  error: {
                    _tag: 'GameLoopStateError' as const,
                    message: 'Can only resume when paused',
                    currentState: state,
                    attemptedTransition: 'resume',
                  } satisfies GameLoopStateError,
                }) as const
            )
          )

          if (!resumeResult.canResume) {
            return yield* Effect.fail((resumeResult as any).error)
          }

          // 原子的な状態更新
          yield* Ref.update(internalState, (s) => ({
            ...s,
            state: 'running' as GameLoopState,
            lastFrameTime: performance.now(),
          }))

          // 単一フレームをスケジュール（連続実行はしない）
          yield* Effect.race(
            Effect.async<void, never, never>((resume) => {
              const frameId = requestAnimationFrame((timestamp) => {
                Effect.runFork(
                  executeFrame(timestamp).pipe(
                    Effect.catchAll((error) =>
                      Effect.sync(() => {
                        console.error('Frame execution failed:', error)
                      })
                    )
                  )
                )
                resume(Effect.succeed(undefined))
              })

              // animationFrameIdの更新
              Effect.runFork(
                Ref.update(internalState, (s) => ({
                  ...s,
                  animationFrameId: frameId,
                }))
              )

              return Effect.sync(() => cancelAnimationFrame(frameId))
            }),
            Effect.sleep(Duration.millis(100)) // タイムアウト保護
          ).pipe(Effect.catchAll(() => Effect.void))
        }),

      stop: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          // アニメーションフレームのキャンセル
          yield* pipe(
            Option.fromNullable(currentState.animationFrameId),
            Option.match({
              onNone: () => Effect.void,
              onSome: (frameId) => Effect.sync(() => cancelAnimationFrame(frameId)),
            })
          )

          // 原子的な状態更新
          yield* Ref.update(internalState, (s) => ({
            ...s,
            state: 'stopped' as GameLoopState,
            animationFrameId: null,
            frameCount: 0,
            lastFrameTime: 0,
            frameCallbacks: [],
          }))
        }),

      onFrame: (callback) =>
        Effect.gen(function* () {
          yield* Ref.update(internalState, (s) => ({
            ...s,
            frameCallbacks: [...s.frameCallbacks, callback],
          }))

          // クリーンアップ関数を返す
          return () => {
            Effect.runFork(
              Ref.update(internalState, (s) => ({
                ...s,
                frameCallbacks: s.frameCallbacks.filter((cb) => cb !== callback),
              })).pipe(Effect.catchAll((error) => Effect.sync(() => console.error('Cleanup failed:', error))))
            )
          }
        }),

      getState: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(internalState)
          return state.state
        }),

      getPerformanceMetrics: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(internalState)

          // Match.valueパターンを使用してパフォーマンスデータチェック
          const metricsResult = pipe(
            state.performanceBuffer.length,
            Match.value,
            Match.when(
              0,
              () =>
                ({
                  hasData: false,
                  error: {
                    _tag: 'GameLoopPerformanceError' as const,
                    message: 'No performance data available',
                    currentFps: 0,
                    targetFps: state.config.targetFps,
                    droppedFrames: 0,
                  } satisfies GameLoopPerformanceError,
                }) as const
            ),
            Match.orElse(() => ({ hasData: true }) as const)
          )

          if (!metricsResult.hasData) {
            return yield* Effect.fail((metricsResult as any).error)
          }

          const averageFps = state.performanceBuffer.reduce((sum, fps) => sum + fps, 0) / state.performanceBuffer.length
          const minFps = Math.min(...state.performanceBuffer)
          const maxFps = Math.max(...state.performanceBuffer)
          const frameTimeMs = 1000 / averageFps

          const metrics: PerformanceMetrics = {
            averageFps,
            minFps,
            maxFps,
            frameTimeMs,
            droppedFrames: state.droppedFrames,
            cpuUsage: undefined, // CPU使用率は別途実装が必要
            memoryUsage: (performance as any).memory?.usedJSHeapSize,
          }

          return metrics
        }),

      tick: (deltaTime) =>
        Effect.gen(function* () {
          // 現在の状態を取得（フレッシュな状態を取得）
          const state = yield* Ref.get(internalState)
          const currentTime = performance.now()
          const actualDeltaTime = deltaTime ?? (state.lastFrameTime > 0 ? currentTime - state.lastFrameTime : 16.67)
          const targetFrameTime = 1000 / state.config.targetFps
          const frameSkipped = actualDeltaTime > targetFrameTime * state.config.maxFrameSkip

          const frameInfo: FrameInfo = {
            currentTime,
            deltaTime: Math.min(actualDeltaTime, targetFrameTime * 2),
            frameCount: state.frameCount,
            fps: actualDeltaTime > 0 ? 1000 / actualDeltaTime : state.config.targetFps,
            frameSkipped,
          }

          // Track dropped frames
          if (frameSkipped) {
            yield* Ref.update(internalState, (s) => ({
              ...s,
              droppedFrames: s.droppedFrames + 1,
            }))
          }

          // Update performance buffer
          const updatedBuffer = [...state.performanceBuffer, frameInfo.fps].slice(-60)

          // コールバックの実行（現在の状態のコールバックのみを実行）
          if (state.frameCallbacks.length > 0) {
            yield* Effect.all(
              state.frameCallbacks.map((callback) => callback(frameInfo)),
              { concurrency: 'unbounded' }
            ).pipe(
              Effect.catchAll((error) =>
                Effect.fail({
                  _tag: 'GameLoopRuntimeError' as const,
                  message: 'Error executing frame callbacks',
                  frameNumber: state.frameCount,
                  error,
                } satisfies GameLoopRuntimeError)
              )
            )
          }

          yield* Ref.update(internalState, (s) => ({
            ...s,
            frameCount: s.frameCount + 1,
            lastFrameTime: currentTime,
            totalFrames: s.totalFrames + 1,
            performanceBuffer: updatedBuffer,
          }))

          return frameInfo
        }),

      updateConfig: (config) =>
        Effect.gen(function* () {
          yield* Ref.update(internalState, (s) => ({
            ...s,
            config: { ...s.config, ...config },
          }))
        }),

      reset: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          // アニメーションフレームのキャンセル
          yield* pipe(
            Option.fromNullable(currentState.animationFrameId),
            Option.match({
              onNone: () => Effect.void,
              onSome: (frameId) => Effect.sync(() => cancelAnimationFrame(frameId)),
            })
          )

          // 完全リセット
          yield* Ref.set(internalState, {
            state: 'idle' as GameLoopState,
            config: DEFAULT_GAME_LOOP_CONFIG,
            frameCount: 0,
            lastFrameTime: 0,
            animationFrameId: null,
            frameCallbacks: [],
            performanceBuffer: [],
            droppedFrames: 0,
            totalFrames: 0,
          })
        }),
    })
  })
)
