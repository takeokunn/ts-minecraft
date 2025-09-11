import { Effect, Context } from 'effect'
import { World, ChunkManager } from '@/infrastructure/layers'

/**
 * World Info View Model
 * ワールド情報をプレゼンテーション層向けに変換・提供
 * チャンク情報、時間、天気などの表示用データを整形
 */
export interface WorldInfoViewModelInterface {
  readonly getWorldInfo: () => Effect.Effect<WorldInfoView, never, never>
  readonly getChunkInfo: () => Effect.Effect<ChunkInfo, never, never>
  readonly getTimeInfo: () => Effect.Effect<TimeInfo, never, never>
  readonly getWeatherInfo: () => Effect.Effect<WeatherInfo, never, never>
}

export interface WorldInfoView {
  readonly name: string
  readonly seed: string
  readonly dimension: string
  readonly chunks: ChunkInfo
  readonly time: TimeInfo
  readonly weather: WeatherInfo
  readonly entities: EntityInfo
  readonly performance: PerformanceInfo
}

export interface ChunkInfo {
  readonly loaded: number
  readonly total: number
  readonly renderDistance: number
  readonly loadedChunks: ChunkStatus[]
}

export interface ChunkStatus {
  readonly x: number
  readonly z: number
  readonly status: 'loading' | 'loaded' | 'generating' | 'error'
  readonly entities: number
  readonly blocks: number
}

export interface TimeInfo {
  readonly worldTime: number
  readonly dayTime: number
  readonly day: number
  readonly timeOfDay: 'dawn' | 'morning' | 'noon' | 'evening' | 'night'
  readonly formatted: string // "Day 1, 12:30"
}

export interface WeatherInfo {
  readonly current: 'clear' | 'rain' | 'storm' | 'snow'
  readonly intensity: number // 0-1
  readonly duration: number // remaining time in ticks
  readonly temperature: number
}

export interface EntityInfo {
  readonly total: number
  readonly players: number
  readonly mobs: number
  readonly items: number
  readonly blocks: number
}

export interface PerformanceInfo {
  readonly tps: number // ticks per second
  readonly mspt: number // milliseconds per tick
  readonly chunkUpdates: number
  readonly entityUpdates: number
}

const WorldInfoViewModelLive = Effect.gen(function* ($) {
  const world = yield* $(World)
  const chunkManager = yield* $(ChunkManager)

  const getWorldInfo = () =>
    Effect.gen(function* ($) {
      // Get chunk information from ChunkManager
      const loadedChunksList = yield* $(chunkManager.getLoadedChunks())
      
      // チャンク情報の取得
      const chunks: ChunkInfo = {
        loaded: loadedChunksList.length,
        total: loadedChunksList.length, // In absence of total chunk info
        renderDistance: 8, // デフォルト値
        loadedChunks: loadedChunksList.map(chunk => ({
          x: chunk.x,
          z: chunk.z,
          status: 'loaded' as const,
          entities: 0, // Default values
          blocks: 256 * 16 * 16, // Standard chunk size estimation
        })),
      }

      // 時間情報の取得（デフォルト値）
      const currentWorldTime = Date.now() % (24000 * 1000) // Simulate world time
      const time: TimeInfo = {
        worldTime: currentWorldTime,
        dayTime: currentWorldTime % 24000,
        day: Math.floor(currentWorldTime / 24000) + 1,
        timeOfDay: getTimeOfDay(currentWorldTime % 24000),
        formatted: formatWorldTime(currentWorldTime),
      }

      // 天気情報の取得（デフォルト値）
      const weather: WeatherInfo = {
        current: 'clear',
        intensity: 0,
        duration: 0,
        temperature: 20,
      }

      // エンティティ情報の取得（デフォルト値）
      const entities: EntityInfo = {
        total: 1,
        players: 1,
        mobs: 0,
        items: 0,
        blocks: 0,
      }

      // パフォーマンス情報の取得（デフォルト値）
      const performance: PerformanceInfo = {
        tps: 20,
        mspt: 50,
        chunkUpdates: 0,
        entityUpdates: 0,
      }

      const worldInfoView: WorldInfoView = {
        name: 'New World',
        seed: '12345',
        dimension: 'overworld',
        chunks,
        time,
        weather,
        entities,
        performance,
      }

      return worldInfoView
    })

  const getChunkInfo = () =>
    Effect.gen(function* ($) {
      const worldInfo = yield* $(getWorldInfo())
      return worldInfo.chunks
    })

  const getTimeInfo = () =>
    Effect.gen(function* ($) {
      const worldInfo = yield* $(getWorldInfo())
      return worldInfo.time
    })

  const getWeatherInfo = () =>
    Effect.gen(function* ($) {
      const worldInfo = yield* $(getWorldInfo())
      return worldInfo.weather
    })

  return {
    getWorldInfo,
    getChunkInfo,
    getTimeInfo,
    getWeatherInfo,
  }
})

// ヘルパー関数
const getTimeOfDay = (dayTime: number): TimeInfo['timeOfDay'] => {
  if (dayTime < 1000) return 'dawn'
  if (dayTime < 6000) return 'morning'
  if (dayTime < 12000) return 'noon'
  if (dayTime < 18000) return 'evening'
  return 'night'
}

const formatWorldTime = (worldTime: number): string => {
  const day = Math.floor(worldTime / 24000) + 1
  const dayTime = worldTime % 24000
  const hours = Math.floor(dayTime / 1000) + 6 // Minecraft時間は6:00から開始
  const minutes = Math.floor((dayTime % 1000) / 1000 * 60)
  
  const displayHours = hours % 24
  const displayMinutes = minutes.toString().padStart(2, '0')
  
  return `Day ${day}, ${displayHours}:${displayMinutes}`
}

export class WorldInfoViewModel extends Context.GenericTag('WorldInfoViewModel')<
  WorldInfoViewModel,
  WorldInfoViewModelInterface
>() {
  static readonly Live = WorldInfoViewModelLive.pipe(Effect.map(WorldInfoViewModel.of))
}