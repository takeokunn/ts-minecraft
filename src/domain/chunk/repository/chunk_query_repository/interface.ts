import { Context, Effect } from 'effect'
import type { ChunkData } from '../../aggregate/chunk_data'
import type { ChunkId } from '../../value_object/chunk_id'
import type { ChunkPosition } from '../../value_object/chunk_position'
import type { RepositoryError } from '../types'

/**
 * Chunk Query Repository Interface
 *
 * チャンクデータの読み取り専用操作を提供するCQRSパターンのQueryサイド
 * 複雑な検索・分析クエリに特化した高性能リードオンリーリポジトリ
 */

// ===== Query-Specific Types ===== //

/**
 * チャンク検索条件（拡張版）
 */
export interface ChunkSearchCriteria {
  readonly positions?: ReadonlyArray<ChunkPosition>
  readonly boundingBox?: {
    readonly minX: number
    readonly maxX: number
    readonly minZ: number
    readonly maxZ: number
  }
  readonly radius?: {
    readonly center: ChunkPosition
    readonly distance: number
  }
  readonly timeRange?: {
    readonly from?: number
    readonly to?: number
  }
  readonly biomeTypes?: ReadonlyArray<string>
  readonly hasBlocks?: ReadonlyArray<string>
  readonly loadState?: 'loaded' | 'unloaded' | 'loading' | 'error'
  readonly sortBy?: 'createdAt' | 'modifiedAt' | 'accessCount' | 'size'
  readonly sortOrder?: 'asc' | 'desc'
  readonly limit?: number
  readonly offset?: number
}

/**
 * チャンク分析データ
 */
export interface ChunkAnalytics {
  readonly totalChunks: number
  readonly loadedChunks: number
  readonly unloadedChunks: number
  readonly loadingChunks: number
  readonly errorChunks: number
  readonly averageLoadTime: number
  readonly memoryUsageByRegion: ReadonlyArray<{
    readonly region: string
    readonly chunks: number
    readonly memoryMB: number
  }>
  readonly accessPatterns: ReadonlyArray<{
    readonly chunkId: ChunkId
    readonly accessCount: number
    readonly lastAccess: number
  }>
  readonly biomeDistribution: ReadonlyArray<{
    readonly biomeType: string
    readonly chunkCount: number
    readonly percentage: number
  }>
}

/**
 * チャンクパフォーマンス統計
 */
export interface ChunkPerformanceStats {
  readonly queryExecutionTimes: ReadonlyArray<{
    readonly query: string
    readonly executionTimeMs: number
    readonly timestamp: number
  }>
  readonly cacheHitRates: ReadonlyArray<{
    readonly period: string
    readonly hitRate: number
    readonly totalQueries: number
  }>
  readonly memoryPressure: {
    readonly currentUsageMB: number
    readonly maxUsageMB: number
    readonly pressureLevel: 'low' | 'medium' | 'high' | 'critical'
  }
  readonly ioPerformance: {
    readonly averageReadTimeMs: number
    readonly averageWriteTimeMs: number
    readonly queueDepth: number
  }
}

/**
 * チャンク相隣関係
 */
export interface ChunkNeighborhood {
  readonly center: ChunkData
  readonly neighbors: {
    readonly north?: ChunkData
    readonly south?: ChunkData
    readonly east?: ChunkData
    readonly west?: ChunkData
    readonly northeast?: ChunkData
    readonly northwest?: ChunkData
    readonly southeast?: ChunkData
    readonly southwest?: ChunkData
  }
  readonly radius2: ReadonlyArray<ChunkData> // 半径2の範囲
  readonly radius3: ReadonlyArray<ChunkData> // 半径3の範囲
}

/**
 * チャンクヒートマップデータ
 */
export interface ChunkHeatmapData {
  readonly region: {
    readonly minX: number
    readonly maxX: number
    readonly minZ: number
    readonly maxZ: number
  }
  readonly data: ReadonlyArray<{
    readonly x: number
    readonly z: number
    readonly value: number
    readonly metadata?: {
      readonly loadTime?: number
      readonly accessCount?: number
      readonly lastModified?: number
    }
  }>
  readonly scale: {
    readonly min: number
    readonly max: number
    readonly unit: string
  }
}

// ===== Repository Interface ===== //

/**
 * ChunkQueryRepository インターフェース
 *
 * 読み取り専用の高性能クエリ操作を提供
 */
export interface ChunkQueryRepository {
  // ===== Basic Query Operations ===== //

  /**
   * 半径内のチャンクを検索
   */
  readonly findChunksInRadius: (
    center: ChunkPosition,
    radius: number
  ) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * 空のチャンク座標を検索
   */
  readonly findEmptyChunks: (region?: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
  }) => Effect.Effect<ReadonlyArray<ChunkPosition>, RepositoryError>

  /**
   * バイオーム別チャンク検索
   */
  readonly findChunksByBiome: (biomeType: string) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * 変更されたチャンクを検索
   */
  readonly findModifiedChunks: (since: number) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * 最頻アクセスチャンクを検索
   */
  readonly findMostAccessedChunks: (limit: number) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * 特定ブロックを含むチャンクを検索
   */
  readonly findChunksContainingBlock: (blockType: string) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  // ===== Advanced Search Operations ===== //

  /**
   * 複合条件によるチャンク検索
   */
  readonly searchChunks: (criteria: ChunkSearchCriteria) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * 全文検索（メタデータ対象）
   */
  readonly fullTextSearch: (query: string) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * 地理的近接検索
   */
  readonly findNearbyChunks: (
    position: ChunkPosition,
    maxDistance: number,
    filters?: Partial<ChunkSearchCriteria>
  ) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * チャンク相隣関係を取得
   */
  readonly getChunkNeighborhood: (
    position: ChunkPosition,
    radius?: number
  ) => Effect.Effect<ChunkNeighborhood, RepositoryError>

  // ===== Analytics and Statistics ===== //

  /**
   * チャンク分析データを取得
   */
  readonly getAnalytics: (timeRange?: { from: number; to: number }) => Effect.Effect<ChunkAnalytics, RepositoryError>

  /**
   * パフォーマンス統計を取得
   */
  readonly getPerformanceStats: () => Effect.Effect<ChunkPerformanceStats, RepositoryError>

  /**
   * 地域別統計を取得
   */
  readonly getRegionalStatistics: (
    regions: ReadonlyArray<{ minX: number; maxX: number; minZ: number; maxZ: number }>
  ) => Effect.Effect<
    ReadonlyArray<{
      readonly region: { minX: number; maxX: number; minZ: number; maxZ: number }
      readonly chunkCount: number
      readonly loadedCount: number
      readonly memoryUsage: number
      readonly averageAccessTime: number
    }>,
    RepositoryError
  >

  /**
   * チャンクヒートマップデータを生成
   */
  readonly generateHeatmap: (
    region: { minX: number; maxX: number; minZ: number; maxZ: number },
    metric: 'accessCount' | 'loadTime' | 'modificationTime' | 'size'
  ) => Effect.Effect<ChunkHeatmapData, RepositoryError>

  // ===== Aggregation Operations ===== //

  /**
   * バイオーム分布を取得
   */
  readonly getBiomeDistribution: (region?: { minX: number; maxX: number; minZ: number; maxZ: number }) => Effect.Effect<
    ReadonlyArray<{
      readonly biomeType: string
      readonly chunkCount: number
      readonly percentage: number
    }>,
    RepositoryError
  >

  /**
   * ブロック型分布を取得
   */
  readonly getBlockTypeDistribution: (region?: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
  }) => Effect.Effect<
    ReadonlyArray<{
      readonly blockType: string
      readonly count: number
      readonly percentage: number
    }>,
    RepositoryError
  >

  /**
   * 時系列統計を取得
   */
  readonly getTimeSeriesStats: (
    metric: 'loadCount' | 'accessCount' | 'modificationCount',
    interval: 'hourly' | 'daily' | 'weekly',
    timeRange: { from: number; to: number }
  ) => Effect.Effect<
    ReadonlyArray<{
      readonly timestamp: number
      readonly value: number
    }>,
    RepositoryError
  >

  // ===== Optimization and Maintenance Queries ===== //

  /**
   * 最適化候補チャンクを検索
   */
  readonly findOptimizationCandidates: () => Effect.Effect<
    ReadonlyArray<{
      readonly chunk: ChunkData
      readonly reason: string
      readonly priority: number
    }>,
    RepositoryError
  >

  /**
   * 孤立チャンクを検索
   */
  readonly findOrphanedChunks: () => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * メモリ圧迫原因チャンクを検索
   */
  readonly findMemoryPressureCauses: () => Effect.Effect<
    ReadonlyArray<{
      readonly chunk: ChunkData
      readonly memoryUsage: number
      readonly reason: string
    }>,
    RepositoryError
  >

  // ===== Real-time Monitoring ===== //

  /**
   * アクティブチャンクを監視
   */
  readonly monitorActiveChunks: () => Effect.Effect<
    ReadonlyArray<{
      readonly chunk: ChunkData
      readonly lastActivity: number
      readonly activityType: string
    }>,
    RepositoryError
  >

  /**
   * クエリパフォーマンスを測定
   */
  readonly measureQueryPerformance: <T>(
    queryName: string,
    query: Effect.Effect<T, RepositoryError>
  ) => Effect.Effect<
    {
      readonly result: T
      readonly executionTimeMs: number
      readonly memoryUsed: number
    },
    RepositoryError
  >
}

// ===== Context Tag ===== //

/**
 * ChunkQueryRepository Context Tag
 */
export const ChunkQueryRepository = Context.GenericTag<ChunkQueryRepository>('ChunkQueryRepository')

// ===== Type Helpers ===== //

/**
 * Query Repository操作の戻り値型ヘルパー
 */
export type ChunkQueryRepositoryEffect<T> = Effect.Effect<T, RepositoryError, ChunkQueryRepository>
