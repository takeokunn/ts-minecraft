import { Effect, Context, Ref } from 'effect'
import { World } from '@/infrastructure/layers'

/**
 * Game State View Model
 * ゲーム全体の状態をプレゼンテーション層向けに変換・提供
 * ビジネスロジックは含まず、表示用データの整形のみを行う
 */
export interface GameStateViewModelInterface {
  readonly getGameState: () => Effect.Effect<GameStateView, never, never>
  readonly getFPS: () => Effect.Effect<number, never, never>
  readonly getMemoryUsage: () => Effect.Effect<MemoryUsage, never, never>
  readonly getLoadingProgress: () => Effect.Effect<LoadingProgress, never, never>
}

export interface GameStateView {
  readonly isRunning: boolean
  readonly isPaused: boolean
  readonly gameTime: number
  readonly fps: number
  readonly memoryUsage: MemoryUsage
  readonly loadingProgress: LoadingProgress
}

export interface MemoryUsage {
  readonly used: number
  readonly total: number
  readonly percentage: number
}

export interface LoadingProgress {
  readonly current: number
  readonly total: number
  readonly percentage: number
  readonly status: 'idle' | 'loading' | 'complete' | 'error'
  readonly message: string
}

const GameStateViewModelLive = Effect.gen(function* ($) {
  const world = yield* $(World)
  
  // 内部状態（必要に応じて）
  const gameStateRef = yield* $(Ref.make<{
    startTime: number
    fps: number
  }>({
    startTime: Date.now(),
    fps: 60,
  }))

  const getGameState = () =>
    Effect.gen(function* ($) {
      // Since World service only has basic block operations, we'll provide default values
      const internalState = yield* $(Ref.get(gameStateRef))
      const currentTime = Date.now()
      const gameTime = currentTime - internalState.startTime

      // メモリ使用量の取得（ブラウザ環境での概算）
      const memoryUsage: MemoryUsage = (() => {
        if (typeof performance !== 'undefined' && 'memory' in performance) {
          const memory = (performance as any).memory
          return {
            used: memory.usedJSHeapSize || 0,
            total: memory.totalJSHeapSize || 0,
            percentage: memory.totalJSHeapSize
              ? Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100)
              : 0,
          }
        }
        return { used: 0, total: 0, percentage: 0 }
      })()

      // ローディング状態のデフォルト値
      const loadingProgress: LoadingProgress = {
        current: 1,
        total: 1,
        percentage: 100,
        status: 'complete' as const,
        message: 'Ready',
      }

      const gameStateView: GameStateView = {
        isRunning: true, // Default assumption
        isPaused: false,
        gameTime,
        fps: internalState.fps,
        memoryUsage,
        loadingProgress,
      }

      return gameStateView
    })

  const getFPS = () =>
    Effect.gen(function* ($) {
      const state = yield* $(Ref.get(gameStateRef))
      return state.fps
    })

  const getMemoryUsage = () =>
    Effect.gen(function* ($) {
      const gameState = yield* $(getGameState())
      return gameState.memoryUsage
    })

  const getLoadingProgress = () =>
    Effect.gen(function* ($) {
      const gameState = yield* $(getGameState())
      return gameState.loadingProgress
    })

  // FPS更新機能（パフォーマンス監視から呼び出される想定）
  const updateFPS = (newFPS: number) =>
    Ref.update(gameStateRef, (state) => ({
      ...state,
      fps: newFPS,
    }))

  return {
    getGameState,
    getFPS,
    getMemoryUsage,
    getLoadingProgress,
    updateFPS, // internal use
  }
})

export class GameStateViewModel extends Context.GenericTag('GameStateViewModel')<
  GameStateViewModel,
  GameStateViewModelInterface & { updateFPS: (fps: number) => Effect.Effect<void, never, never> }
>() {
  static readonly Live = GameStateViewModelLive.pipe(Effect.map(GameStateViewModel.of))
}