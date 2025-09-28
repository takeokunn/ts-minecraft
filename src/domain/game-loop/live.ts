import { Array as A, Effect, Layer, Match, Option, pipe, Ref } from 'effect'
import type { FrameInfo, GameLoopConfig, GameLoopState, PerformanceMetrics } from '../types/types'
import { DEFAULT_GAME_LOOP_CONFIG } from '../types/types'
import { GameLoopService } from './GameLoopService'

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

    return GameLoopService.of({
      initialize: (config) =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          // 状態チェックをMatch.valueで実装
          const canInit = currentState.state === 'idle' || currentState.state === 'stopped'
          yield* pipe(
            Match.value(canInit),
            Match.when(false, () =>
              Effect.fail({
                _tag: 'GameLoopInitError' as const,
                message: 'GameLoop is already initialized',
                reason: `Current state is ${currentState.state}`,
              })
            ),
            Match.when(true, () => Effect.void),
            Match.exhaustive
          )

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

          // 状態遷移チェックをMatch.valueで実装
          const validStates: GameLoopState[] = ['idle', 'paused', 'running']
          const isValidState = A.contains(currentState.state)(validStates)
          yield* pipe(
            Match.value(isValidState),
            Match.when(false, () =>
              Effect.fail({
                _tag: 'GameLoopStateError' as const,
                message: 'Invalid state transition',
                currentState: currentState.state,
                attemptedTransition: 'start',
              })
            ),
            Match.when(true, () => Effect.void),
            Match.exhaustive
          )

          // 既に実行中かチェックしてMatch.valueで処理
          yield* pipe(
            Match.value(currentState.state),
            Match.when('running', () => Effect.void),
            Match.orElse(() =>
              Ref.update(internalState, (s) => ({
                ...s,
                state: 'running' as GameLoopState,
                lastFrameTime: performance.now(),
              }))
            )
          )
        }),

      pause: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          yield* pipe(
            Match.value(currentState.state),
            Match.when('running', () => Effect.void),
            Match.orElse(() =>
              Effect.fail({
                _tag: 'GameLoopStateError' as const,
                message: 'Can only pause when running',
                currentState: currentState.state,
                attemptedTransition: 'pause',
              })
            )
          )

          // アニメーションフレームのキャンセルをOption.matchで実装
          yield* pipe(
            Option.fromNullable(currentState.animationFrameId),
            Option.match({
              onNone: () => Effect.void,
              onSome: (id) => Effect.sync(() => cancelAnimationFrame(id)),
            })
          )

          yield* Ref.update(internalState, (s) => ({
            ...s,
            state: 'paused' as GameLoopState,
            animationFrameId: null,
          }))
        }),

      resume: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          yield* pipe(
            Match.value(currentState.state),
            Match.when('paused', () => Effect.void),
            Match.orElse(() =>
              Effect.fail({
                _tag: 'GameLoopStateError' as const,
                message: 'Can only resume when paused',
                currentState: currentState.state,
                attemptedTransition: 'resume',
              })
            )
          )

          yield* Ref.update(internalState, (s) => ({
            ...s,
            state: 'running' as GameLoopState,
            lastFrameTime: performance.now(),
          }))
        }),

      stop: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          // アニメーションフレームのキャンセルをOption.matchで実装
          yield* pipe(
            Option.fromNullable(currentState.animationFrameId),
            Option.match({
              onNone: () => Effect.void,
              onSome: (id) => Effect.sync(() => cancelAnimationFrame(id)),
            })
          )

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

          return () => {
            Effect.runFork(
              Ref.update(internalState, (s) => ({
                ...s,
                frameCallbacks: s.frameCallbacks.filter((cb) => cb !== callback),
              }))
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

          // パフォーマンスデータ有無をMatch.valueで判定
          const hasPerformanceData = state.performanceBuffer.length > 0
          yield* pipe(
            Match.value(hasPerformanceData),
            Match.when(false, () =>
              Effect.fail({
                _tag: 'GameLoopPerformanceError' as const,
                message: 'No performance data available',
                currentFps: 0,
                targetFps: state.config.targetFps,
                droppedFrames: 0,
              })
            ),
            Match.when(true, () => Effect.void),
            Match.exhaustive
          )

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
            cpuUsage: undefined,
            memoryUsage: (performance as any).memory?.usedJSHeapSize,
          }

          return metrics
        }),

      tick: (deltaTime) =>
        Effect.gen(function* () {
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

          // フレームドロップをEffect.whenで追跡
          yield* Effect.when(
            Ref.update(internalState, (s) => ({
              ...s,
              droppedFrames: s.droppedFrames + 1,
            })),
            () => frameSkipped
          )

          // Update performance buffer
          const updatedBuffer = [...state.performanceBuffer, frameInfo.fps].slice(-60)

          // コールバックの実行をEffect.whenで処理
          yield* Effect.when(
            Effect.all(
              state.frameCallbacks.map((callback) => callback(frameInfo)),
              { concurrency: 'unbounded' }
            ).pipe(
              Effect.catchAll((error) =>
                Effect.fail({
                  _tag: 'GameLoopRuntimeError' as const,
                  message: 'Error executing frame callbacks',
                  frameNumber: state.frameCount,
                  error,
                })
              )
            ),
            () => state.frameCallbacks.length > 0
          )

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

          // アニメーションフレームのキャンセルをOption.matchで実装
          yield* pipe(
            Option.fromNullable(currentState.animationFrameId),
            Option.match({
              onNone: () => Effect.void,
              onSome: (id) => Effect.sync(() => cancelAnimationFrame(id)),
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
