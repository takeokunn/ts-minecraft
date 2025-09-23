import { Effect, Layer, Ref, Schedule, Stream } from 'effect'
import { GameLoopService } from './GameLoopService'
import type { FrameInfo, GameLoopConfig, PerformanceMetrics } from './types'
import type { GameLoopState } from './types'
import { DEFAULT_GAME_LOOP_CONFIG } from './types'
import {
  GameLoopInitError,
  GameLoopPerformanceError,
  GameLoopRuntimeError,
  GameLoopStateError,
} from './errors'

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

    // フレーム実行ロジック
    const executeFrame = (timestamp: number) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(internalState)

        if (state.state !== 'running') {
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

        // 次フレームのスケジューリング
        if (state.state === 'running') {
          const nextFrameId = requestAnimationFrame((ts) => {
            Effect.runPromise(executeFrame(ts)).catch(console.error)
          })

          yield* Ref.update(internalState, (s) => ({
            ...s,
            animationFrameId: nextFrameId,
          }))
        }
      })

    return GameLoopService.of({
      initialize: (config) =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          if (currentState.state !== 'idle' && currentState.state !== 'stopped') {
            return yield* Effect.fail(
              new GameLoopInitError({
                message: 'GameLoop is already initialized',
                reason: `Current state is ${currentState.state}`,
              })
            )
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

          if (currentState.state === 'running') {
            return
          }

          if (currentState.state !== 'idle' && currentState.state !== 'paused') {
            return yield* Effect.fail(
              new GameLoopStateError({
                message: 'Invalid state transition',
                currentState: currentState.state,
                attemptedTransition: 'start',
              })
            )
          }

          yield* Ref.update(internalState, (s) => ({
            ...s,
            state: 'running' as GameLoopState,
            lastFrameTime: performance.now(),
          }))

          // 最初のフレームを開始
          const frameId = requestAnimationFrame((timestamp) => {
            Effect.runPromise(executeFrame(timestamp)).catch(console.error)
          })

          yield* Ref.update(internalState, (s) => ({
            ...s,
            animationFrameId: frameId,
          }))
        }),

      pause: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

          if (currentState.state !== 'running') {
            return yield* Effect.fail(
              new GameLoopStateError({
                message: 'Can only pause when running',
                currentState: currentState.state,
                attemptedTransition: 'pause',
              })
            )
          }

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
            return yield* Effect.fail(
              new GameLoopStateError({
                message: 'Can only resume when paused',
                currentState: currentState.state,
                attemptedTransition: 'resume',
              })
            )
          }

          yield* Ref.update(internalState, (s) => ({
            ...s,
            state: 'running' as GameLoopState,
            lastFrameTime: performance.now(),
          }))

          const frameId = requestAnimationFrame((timestamp) => {
            Effect.runPromise(executeFrame(timestamp)).catch(console.error)
          })

          yield* Ref.update(internalState, (s) => ({
            ...s,
            animationFrameId: frameId,
          }))
        }),

      stop: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(internalState)

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

          // クリーンアップ関数を返す
          return () => {
            Effect.runPromise(
              Ref.update(internalState, (s) => ({
                ...s,
                frameCallbacks: s.frameCallbacks.filter((cb) => cb !== callback),
              }))
            ).catch(console.error)
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

          if (state.performanceBuffer.length === 0) {
            return yield* Effect.fail(
              new GameLoopPerformanceError({
                message: 'No performance data available',
                currentFps: 0,
                targetFps: state.config.targetFps,
                droppedFrames: 0,
              })
            )
          }

          const averageFps =
            state.performanceBuffer.reduce((sum, fps) => sum + fps, 0) /
            state.performanceBuffer.length
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
          yield* Effect.all(
            state.frameCallbacks.map((callback) => callback(frameInfo)),
            { concurrency: 'unbounded' }
          ).pipe(
            Effect.catchAll((error) =>
              Effect.fail(
                new GameLoopRuntimeError({
                  message: 'Error executing frame callbacks',
                  frameNumber: state.frameCount,
                  error,
                })
              )
            )
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

          if (currentState.animationFrameId !== null) {
            cancelAnimationFrame(currentState.animationFrameId)
          }

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