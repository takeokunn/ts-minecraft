import { Effect, Context, Layer, Ref } from 'effect'
import { QueryHandlers } from '@application/handlers/query.handler'
import { BrowserApiService } from '@presentation/services/browser-api.service'

/**
 * World Info View Model - Simplified
 * ワールド情報をプレゼンテーション層向けに変換・提供
 * クエリハンドラーからデータを取得し、表示用に変換
 */
export interface WorldInfoViewModelInterface {
  readonly getWorldInfo: () => Effect.Effect<WorldInfoView, Error, never>
  readonly getChunkCount: () => Effect.Effect<number, Error, never>
}

export interface WorldInfoView {
  readonly name: string
  readonly seed: string
  readonly loadedChunks: number
  readonly time: TimeInfo
  readonly weather: WeatherInfo
}

export interface TimeInfo {
  readonly day: number
  readonly timeOfDay: 'dawn' | 'morning' | 'noon' | 'evening' | 'night'
  readonly formatted: string // "Day 1, 12:30"
}

export interface WeatherInfo {
  readonly current: 'clear' | 'rain' | 'storm' | 'snow'
  readonly temperature: number
}

const WorldInfoViewModelLive = Effect.gen(function* ($) {
  const queryHandlers = yield* $(QueryHandlers)
  const browserApi = yield* $(BrowserApiService)

  // 表示用の時間計算（純粋な変換関数）
  const calculateWorldTime = (startTime: number, currentTime: number): TimeInfo => {
    const elapsed = currentTime - startTime
    const worldTime = Math.floor(elapsed / 100) // 加速されたワールド時間

    const day = Math.floor(worldTime / 24000) + 1
    const dayTime = worldTime % 24000

    const getTimeOfDay = (dayTime: number): TimeInfo['timeOfDay'] => {
      if (dayTime < 1000) return 'dawn'
      if (dayTime < 6000) return 'morning'
      if (dayTime < 12000) return 'noon'
      if (dayTime < 18000) return 'evening'
      return 'night'
    }

    const formatTime = (): string => {
      const hours = Math.floor(dayTime / 1000) + 6 // 6:00から開始
      const minutes = Math.floor(((dayTime % 1000) / 1000) * 60)
      const displayHours = hours % 24
      return `Day ${day}, ${displayHours}:${minutes.toString().padStart(2, '0')}`
    }

    return {
      day,
      timeOfDay: getTimeOfDay(dayTime),
      formatted: formatTime(),
    }
  }

  const getWorldInfo = () =>
    Effect.gen(function* ($) {
      // クエリハンドラーからワールドデータを取得
      const worldState = yield* $(
        queryHandlers.getWorldState({
          includeEntities: false,
          includeChunks: true,
          includePhysics: false,
        }),
      )

      const loadedChunks = yield* $(queryHandlers.getLoadedChunks())
      const currentTime = yield* $(browserApi.getCurrentTime())

      // 表示用データ変換（純粋な変換処理のみ）
      return {
        name: 'New World', // ワールド名はワールド設定から取得すべき
        seed: '12345', // シードは保存された設定から取得すべき
        loadedChunks: loadedChunks.length,
        time: calculateWorldTime(currentTime - 60000, currentTime), // 仮の開始時間
        weather: { current: 'clear' as const, temperature: 20 }, // 天候は別のクエリから取得すべき
      }
    })

  const getChunkCount = () =>
    Effect.gen(function* ($) {
      const loadedChunks = yield* $(queryHandlers.getLoadedChunks())
      return loadedChunks.length
    })

  return {
    getWorldInfo,
    getChunkCount,
  }
})

// Create context tag for dependency injection
export const WorldInfoViewModel = Context.GenericTag<WorldInfoViewModelInterface>('WorldInfoViewModel')

// Layer for dependency injection
export const WorldInfoViewModelLive: Layer.Layer<WorldInfoViewModel, never, QueryHandlers | BrowserApiService> = Layer.effect(WorldInfoViewModel, WorldInfoViewModelLive)

// Factory function for direct usage (deprecated - use Layer instead)
export const createWorldInfoViewModel = (queryHandlers: QueryHandlers, browserApi: BrowserApiService) => 
  Effect.runSync(Effect.provide(WorldInfoViewModelLive, 
    Layer.mergeAll(
      Layer.succeed(QueryHandlers, queryHandlers),
      Layer.succeed(BrowserApiService, browserApi)
    )
  ))
