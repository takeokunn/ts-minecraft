import { Effect, Context, Layer, Ref } from 'effect'
import { QueryHandlers } from '@application/handlers/query-handlers'

/**
 * Game State View Model - Simplified
 * ゲーム全体の状態をプレゼンテーション層向けに変換・提供
 * クエリハンドラーからデータを取得し、表示用に変換
 */
export interface GameStateViewModelInterface {
  readonly getGameState: () => Effect.Effect<GameStateView, Error, never>
  readonly updateFPS: (fps: number) => Effect.Effect<void, never, never>
}

export interface GameStateView {
  readonly isRunning: boolean
  readonly isPaused: boolean
  readonly gameTime: number
  readonly fps: number
  readonly memoryUsage: MemoryUsage
}

export interface MemoryUsage {
  readonly used: number
  readonly total: number
  readonly percentage: number
}

const GameStateViewModelLive = Effect.gen(function* ($) {
  const queryHandlers = yield* $(QueryHandlers)

  // 軽量なローカル状態（表示用のみ）
  const presentationStateRef = yield* $(
    Ref.make({
      startTime: Date.now(),
      fps: 60,
      isRunning: false,
      isPaused: false,
    }),
  )

  const getGameState = () =>
    Effect.gen(function* ($) {
      const presentationState = yield* $(Ref.get(presentationStateRef))

      // Query handlers からデータを取得
      const worldState = yield* $(
        queryHandlers.getWorldState({
          includeEntities: true,
          includeChunks: true,
          includePhysics: false,
        }),
      )

      const currentTime = Date.now()
      const gameTime = currentTime - presentationState.startTime

      // 表示用のメモリ使用量計算（純粋な変換処理）
      const getMemoryUsage = (): MemoryUsage => {
        if (typeof performance !== 'undefined' && 'memory' in performance) {
          const memory = (performance as any).memory
          const used = memory.usedJSHeapSize || 0
          const total = memory.totalJSHeapSize || 0
          return {
            used,
            total,
            percentage: total ? Math.round((used / total) * 100) : 0,
          }
        }
        return { used: 0, total: 0, percentage: 0 }
      }

      // データの表示用変換（純粋な変換処理）
      return {
        isRunning: presentationState.isRunning,
        isPaused: presentationState.isPaused,
        gameTime,
        fps: presentationState.fps,
        memoryUsage: getMemoryUsage(),
      }
    })

  const updateFPS = (fps: number) =>
    Ref.update(presentationStateRef, (state) => ({
      ...state,
      fps,
    }))

  const updateGameRunningState = (isRunning: boolean, isPaused = false) =>
    Ref.update(presentationStateRef, (state) => ({
      ...state,
      isRunning,
      isPaused,
    }))

  return {
    getGameState,
    updateFPS,
    updateGameRunningState, // internal use
  }
})

// Extended interface for internal usage
export interface GameStateViewModelExtended extends GameStateViewModelInterface {
  readonly updateGameRunningState: (isRunning: boolean, isPaused?: boolean) => Effect.Effect<void, never, never>
}

// Create context tag for dependency injection
export const GameStateViewModel = Context.GenericTag<GameStateViewModelExtended>('GameStateViewModel')

// Layer for dependency injection
export const GameStateViewModelLive: Layer.Layer<GameStateViewModel, never, QueryHandlers> = 
  Layer.effect(GameStateViewModel, GameStateViewModelLive)

// Factory function for direct usage
export const createGameStateViewModel = (queryHandlers: any) => 
  Effect.runSync(Effect.provide(GameStateViewModelLive, Layer.succeed(QueryHandlers, queryHandlers)))
