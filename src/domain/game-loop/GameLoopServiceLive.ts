import { Effect, Layer, Ref, Option, pipe } from 'effect'
import { GameLoopService } from './GameLoopService'
import type { FrameInfo, GameLoopConfig, PerformanceMetrics, GameLoopState } from './types'
import { DEFAULT_GAME_LOOP_CONFIG } from './types'
import type { GameLoopInitError, GameLoopPerformanceError, GameLoopRuntimeError, GameLoopStateError } from './errors'

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

          // 状態チェック
          const canInit = currentState.state === 'idle' || currentState.state === 'stopped'
          if (!canInit) {
            return yield* Effect.fail({
              _tag: 'GameLoopInitError' as const,
              message: 'GameLoop is already initialized',
              reason: `Current state is ${currentState.state}`,
            })
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

          // 状態遷移チェック
          const validStates = ['idle', 'paused', 'running']
          if (!validStates.includes(currentState.state)) {
            return yield* Effect.fail({
              _tag: 'GameLoopStateError' as const,
              message: 'Invalid state transition',
              currentState: currentState.state,
              attemptedTransition: 'start',
            })
          }

          // 既に実行中なら何もしない
          if (currentState.state === 'running') {
            return
          }

          yield* Ref.update(internalState, (s) => ({
            ...s,
            state: 'running' as GameLoopState,
            lastFrameTime: performance.now(),
          }))
        }),

      pause: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          if (currentState.state !== 'running') {
            return yield* Effect.fail({
              _tag: 'GameLoopStateError' as const,
              message: 'Can only pause when running',
              currentState: currentState.state,
              attemptedTransition: 'pause',
            })
          }

          // アニメーションフレームのキャンセル
          if (currentState.animationFrameId !== null) {
            cancelAnimationFrame(currentState.animationFrameId)
          }

          yield* Ref.update(internalState, (s) => ({
            ...s,
            state: 'paused' as GameLoopState,
            animationFrameId: null,
          }))
        }),

      resume: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          if (currentState.state !== 'paused') {
            return yield* Effect.fail({
              _tag: 'GameLoopStateError' as const,
              message: 'Can only resume when paused',
              currentState: currentState.state,
              attemptedTransition: 'resume',
            })
          }

          yield* Ref.update(internalState, (s) => ({
            ...s,
            state: 'running' as GameLoopState,
            lastFrameTime: performance.now(),
          }))
        }),

      stop: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          // アニメーションフレームのキャンセル
          if (currentState.animationFrameId !== null) {
            cancelAnimationFrame(currentState.animationFrameId)
          }

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

          // パフォーマンスデータが無い場合はエラー
          if (state.performanceBuffer.length === 0) {
            return yield* Effect.fail({
              _tag: 'GameLoopPerformanceError' as const,
              message: 'No performance data available',
              currentFps: 0,
              targetFps: state.config.targetFps,
              droppedFrames: 0,
            })
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

          // Track dropped frames
          if (frameSkipped) {
            yield* Ref.update(internalState, (s) => ({
              ...s,
              droppedFrames: s.droppedFrames + 1,
            }))
          }

          // Update performance buffer
          const updatedBuffer = [...state.performanceBuffer, frameInfo.fps].slice(-60)

          // コールバックの実行
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
                })
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
          if (currentState.animationFrameId !== null) {
            cancelAnimationFrame(currentState.animationFrameId)
          }

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
