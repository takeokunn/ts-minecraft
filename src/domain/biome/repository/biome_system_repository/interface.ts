/**
 * @fileoverview Biome System Repository Interface
 * バイオームシステムリポジトリのインターフェース定義
 *
 * バイオーム管理・空間インデックス・気候データ永続化
 * 効率的な地理的検索と高性能キャッシング
 */

import type { BiomeRegistry } from '@/domain/biome/aggregate/biome_system/biome_registry'
import type { ClimateData } from '@/domain/biome/domain_service/biome_classification/climate_calculator'
import type { BiomeRepositoryError } from '@/domain/biome/repository/errors'
import { BiomeId } from '@/domain/biome/value_object/biome_id'
import { makeUnsafeWorldCoordinate2D } from '@/domain/biome/value_object/coordinates'
import type { WorldCoordinate } from '@/domain/biome/value_object/coordinates/world_coordinate'
import type { JsonRecord } from '@shared/schema/json'
import { Context, Effect, Option, ReadonlyArray } from 'effect'

// === Spatial Index Types ===

/**
 * 空間座標
 */
export interface SpatialCoordinate {
  readonly x: WorldCoordinate
  readonly z: WorldCoordinate
}

/**
 * 空間範囲
 */
export interface SpatialBounds {
  readonly minX: WorldCoordinate
  readonly minZ: WorldCoordinate
  readonly maxX: WorldCoordinate
  readonly maxZ: WorldCoordinate
}

/**
 * バイオーム配置データ
 */

export interface BiomePlacement {
  readonly biomeId: BiomeId
  readonly coordinate: SpatialCoordinate
  readonly radius: number
  readonly priority: number
  readonly placedAt: Date
  readonly metadata: JsonRecord
}

/**
 * 空間クエリ結果
 */
export interface SpatialQueryResult {
  readonly biomeId: BiomeId
  readonly coordinate: SpatialCoordinate
  readonly distance: number
  readonly confidence: number
}

// === Climate System Types ===

/**
 * 気候グリッド
 */
export interface ClimateGrid {
  readonly resolution: number // meters per grid cell
  readonly bounds: SpatialBounds
  readonly data: Map<string, ClimateData> // key: "x,z"
  readonly interpolation: 'nearest' | 'bilinear' | 'bicubic'
}

/**
 * 気候変化データ
 */
export interface ClimateTransition {
  readonly fromBiome: BiomeId
  readonly toBiome: BiomeId
  readonly transitionZone: SpatialBounds
  readonly gradientFactor: number // 0.0 - 1.0
  readonly seasonalVariation: boolean
}

// === Query Types ===

/**
 * バイオーム検索クエリ
 */
export interface BiomeQuery {
  readonly biomeId?: BiomeId
  readonly category?: string
  readonly temperature?: {
    readonly min?: Temperature
    readonly max?: Temperature
  }
  readonly humidity?: {
    readonly min?: Humidity
    readonly max?: Humidity
  }
  readonly coordinates?: SpatialCoordinate
  readonly radius?: number
  readonly limit?: number
  readonly includeTransitions?: boolean
}

/**
 * 空間検索クエリ
 */
export interface SpatialQuery {
  readonly center: SpatialCoordinate
  readonly radius: number
  readonly biomeTypes?: ReadonlyArray<BiomeId>
  readonly maxResults?: number
  readonly sortBy?: 'distance' | 'priority' | 'area'
  readonly includeMetadata?: boolean
}

/**
 * バイオーム統計情報
 */
export interface BiomeStatistics {
  readonly totalBiomes: number
  readonly uniqueBiomeTypes: number
  readonly coverage: Record<BiomeId, number> // percentage coverage
  readonly dominantBiome: BiomeId
  readonly raresBiomes: ReadonlyArray<BiomeId>
  readonly averageTemperature: Temperature
  readonly averageHumidity: Humidity
  readonly spatialDistribution: {
    readonly clustered: number
    readonly dispersed: number
    readonly random: number
  }
}

// === Repository Interface ===

/**
 * Biome System Repository インターフェース
 */
type BiomeDefinition = BiomeRegistry['biomes'][number]

export type Temperature = number
export type Humidity = number

export interface BiomeSystemRepository {
  // === Biome Definition Management ===

  /**
   * バイオーム定義保存
   */
  readonly saveBiomeDefinition: (biome: BiomeDefinition) => Effect.Effect<void, BiomeRepositoryError>

  /**
   * バイオーム定義取得
   */
  readonly findBiomeDefinition: (
    biomeId: BiomeId
  ) => Effect.Effect<Option.Option<BiomeDefinition>, BiomeRepositoryError>

  /**
   * 全バイオーム定義取得
   */
  readonly findAllBiomeDefinitions: () => Effect.Effect<ReadonlyArray<BiomeDefinition>, BiomeRepositoryError>

  /**
   * バイオーム定義更新
   */
  readonly updateBiomeDefinition: (biome: BiomeDefinition) => Effect.Effect<void, BiomeRepositoryError>

  /**
   * バイオーム定義削除
   */
  readonly deleteBiomeDefinition: (biomeId: BiomeId) => Effect.Effect<void, BiomeRepositoryError>

  // === Spatial Biome Placement ===

  /**
   * バイオーム配置
   */
  readonly placeBiome: (placement: BiomePlacement) => Effect.Effect<void, BiomeRepositoryError>

  /**
   * 座標のバイオーム取得
   */
  readonly getBiomeAt: (coordinate: SpatialCoordinate) => Effect.Effect<Option.Option<BiomeId>, BiomeRepositoryError>

  /**
   * 範囲内のバイオーム取得
   */
  readonly getBiomesInBounds: (
    bounds: SpatialBounds
  ) => Effect.Effect<ReadonlyArray<SpatialQueryResult>, BiomeRepositoryError>

  /**
   * 半径検索
   */
  readonly findBiomesInRadius: (
    center: SpatialCoordinate,
    radius: number
  ) => Effect.Effect<ReadonlyArray<SpatialQueryResult>, BiomeRepositoryError>

  /**
   * 最近傍バイオーム検索
   */
  readonly findNearestBiome: (
    coordinate: SpatialCoordinate,
    biomeType?: BiomeId
  ) => Effect.Effect<Option.Option<SpatialQueryResult>, BiomeRepositoryError>

  /**
   * 空間クエリ実行
   */
  readonly executeQuery: (query: SpatialQuery) => Effect.Effect<ReadonlyArray<SpatialQueryResult>, BiomeRepositoryError>

  // === Climate Data Management ===

  /**
   * 気候データ設定
   */
  readonly setClimateData: (
    coordinate: SpatialCoordinate,
    climate: ClimateData
  ) => Effect.Effect<void, BiomeRepositoryError>

  /**
   * 気候データ取得
   */
  readonly getClimateData: (
    coordinate: SpatialCoordinate
  ) => Effect.Effect<Option.Option<ClimateData>, BiomeRepositoryError>

  /**
   * 気候データ補間取得
   */
  readonly interpolateClimateData: (coordinate: SpatialCoordinate) => Effect.Effect<ClimateData, BiomeRepositoryError>

  /**
   * 気候グリッド作成
   */
  readonly createClimateGrid: (
    bounds: SpatialBounds,
    resolution: number
  ) => Effect.Effect<ClimateGrid, BiomeRepositoryError>

  /**
   * 気候遷移設定
   */
  readonly setClimateTransition: (transition: ClimateTransition) => Effect.Effect<void, BiomeRepositoryError>

  // === Spatial Indexing ===

  /**
   * 空間インデックス再構築
   */
  readonly rebuildSpatialIndex: () => Effect.Effect<void, BiomeRepositoryError>

  /**
   * インデックス統計取得
   */
  readonly getIndexStatistics: () => Effect.Effect<
    {
      readonly totalEntries: number
      readonly indexDepth: number
      readonly leafNodes: number
      readonly averageEntriesPerNode: number
      readonly spatialCoverage: SpatialBounds
    },
    BiomeRepositoryError
  >

  /**
   * インデックス最適化
   */
  readonly optimizeIndex: () => Effect.Effect<
    {
      readonly beforeNodes: number
      readonly afterNodes: number
      readonly improvementRatio: number
    },
    BiomeRepositoryError
  >

  // === Cache Management ===

  /**
   * バイオームキャッシュ更新
   */
  readonly updateBiomeCache: (
    coordinate: SpatialCoordinate,
    biomeId: BiomeId,
    ttl?: number
  ) => Effect.Effect<void, BiomeRepositoryError>

  /**
   * キャッシュクリア
   */
  readonly clearCache: (bounds?: SpatialBounds) => Effect.Effect<void, BiomeRepositoryError>

  /**
   * キャッシュ統計取得
   */
  readonly getCacheStatistics: () => Effect.Effect<
    {
      readonly hitRate: number
      readonly missRate: number
      readonly size: number
      readonly maxSize: number
      readonly evictionCount: number
      readonly averageAccessTime: number
    },
    BiomeRepositoryError
  >

  /**
   * キャッシュウォームアップ
   */
  readonly warmupCache: (bounds: SpatialBounds) => Effect.Effect<void, BiomeRepositoryError>

  // === Bulk Operations ===

  /**
   * 複数バイオーム配置
   */
  readonly placeBiomes: (placements: ReadonlyArray<BiomePlacement>) => Effect.Effect<
    {
      readonly successful: number
      readonly failed: number
      readonly errors: ReadonlyArray<BiomeRepositoryError>
    },
    BiomeRepositoryError
  >

  /**
   * 領域バイオーム更新
   */
  readonly updateBiomesInBounds: (
    bounds: SpatialBounds,
    biomeId: BiomeId
  ) => Effect.Effect<number, BiomeRepositoryError>

  /**
   * 領域バイオーム削除
   */
  readonly clearBiomesInBounds: (bounds: SpatialBounds) => Effect.Effect<number, BiomeRepositoryError>

  // === Statistics & Analysis ===

  /**
   * バイオーム統計取得
   */
  readonly getStatistics: (bounds?: SpatialBounds) => Effect.Effect<BiomeStatistics, BiomeRepositoryError>

  /**
   * バイオーム分布分析
   */
  readonly analyzeBiomeDistribution: (bounds: SpatialBounds) => Effect.Effect<
    {
      readonly entropy: number
      readonly uniformity: number
      readonly clustering: number
      readonly diversity: number
      readonly fragmentation: number
    },
    BiomeRepositoryError
  >

  /**
   * バイオーム遷移分析
   */
  readonly analyzeTransitions: (bounds: SpatialBounds) => Effect.Effect<
    ReadonlyArray<{
      readonly fromBiome: BiomeId
      readonly toBiome: BiomeId
      readonly transitionCount: number
      readonly averageGradient: number
    }>,
    BiomeRepositoryError
  >

  // === Data Export/Import ===

  /**
   * バイオームデータエクスポート
   */
  readonly exportBiomeData: (
    bounds: SpatialBounds,
    format: 'json' | 'binary' | 'image'
  ) => Effect.Effect<Uint8Array, BiomeRepositoryError>

  /**
   * バイオームデータインポート
   */
  readonly importBiomeData: (
    data: Uint8Array,
    format: 'json' | 'binary' | 'image',
    bounds: SpatialBounds
  ) => Effect.Effect<void, BiomeRepositoryError>

  /**
   * バイオームマップ生成
   */
  readonly generateBiomeMap: (
    bounds: SpatialBounds,
    resolution: number
  ) => Effect.Effect<
    {
      readonly imageData: Uint8Array
      readonly width: number
      readonly height: number
      readonly legend: Record<BiomeId, string> // color mapping
    },
    BiomeRepositoryError
  >

  // === Repository Management ===

  /**
   * リポジトリ初期化
   */
  readonly initialize: () => Effect.Effect<void, BiomeRepositoryError>

  /**
   * リポジトリクリーンアップ
   */
  readonly cleanup: () => Effect.Effect<void, BiomeRepositoryError>

  /**
   * データ整合性検証
   */
  readonly validateIntegrity: () => Effect.Effect<
    {
      readonly isValid: boolean
      readonly errors: ReadonlyArray<string>
      readonly warnings: ReadonlyArray<string>
      readonly spatialErrors: ReadonlyArray<{
        readonly coordinate: SpatialCoordinate
        readonly issue: string
      }>
    },
    BiomeRepositoryError
  >
}

// === Context Tag Definition ===

/**
 * Biome System Repository Context Tag
 */
export const BiomeSystemRepository = Context.GenericTag<BiomeSystemRepository>(
  '@minecraft/domain/world/repository/BiomeSystemRepository'
)

// === Configuration Types ===

/**
 * Repository設定
 */
export interface BiomeSystemRepositoryConfig {
  readonly storage: {
    readonly type: 'memory' | 'indexeddb' | 'filesystem'
    readonly location?: string
    readonly maxBiomes?: number
  }
  readonly spatialIndex: {
    readonly type: 'quadtree' | 'rtree' | 'grid'
    readonly maxDepth: number
    readonly maxEntriesPerNode: number
    readonly minNodeSize: number
  }
  readonly cache: {
    readonly enabled: boolean
    readonly maxSize: number
    readonly ttlSeconds: number
    readonly spatialCacheEnabled: boolean
    readonly climateCacheEnabled: boolean
  }
  readonly climate: {
    readonly gridResolution: number
    readonly interpolationMethod: 'nearest' | 'bilinear' | 'bicubic'
    readonly enableTransitions: boolean
    readonly transitionSmoothing: number
  }
  readonly performance: {
    readonly enableProfiling: boolean
    readonly enableMetrics: boolean
    readonly batchSize: number
    readonly indexOptimizationInterval: number
  }
}

// === Default Configuration ===

export const defaultBiomeSystemRepositoryConfig: BiomeSystemRepositoryConfig = {
  storage: {
    type: 'memory',
    maxBiomes: 100000,
  },
  spatialIndex: {
    type: 'quadtree',
    maxDepth: 12,
    maxEntriesPerNode: 16,
    minNodeSize: 64,
  },
  cache: {
    enabled: true,
    maxSize: 10000,
    ttlSeconds: 300, // 5 minutes
    spatialCacheEnabled: true,
    climateCacheEnabled: true,
  },
  climate: {
    gridResolution: 16, // 16 meters per grid cell
    interpolationMethod: 'bilinear',
    enableTransitions: true,
    transitionSmoothing: 0.5,
  },
  performance: {
    enableProfiling: false,
    enableMetrics: true,
    batchSize: 1000,
    indexOptimizationInterval: 3600000, // 1 hour
  },
}

// === Utility Functions ===

/**
 * 空間座標からキー生成
 */
export const coordinateToKey = (coord: SpatialCoordinate): string => `${coord.x},${coord.z}`

/**
 * キーから空間座標復元
 */
export const keyToCoordinate = (key: string): SpatialCoordinate => {
  const [x, z] = key.split(',').map(Number)
  return makeUnsafeWorldCoordinate2D(x, z)
}

/**
 * 空間範囲の重複判定
 */
export const boundsIntersect = (a: SpatialBounds, b: SpatialBounds): boolean =>
  !(a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ)

/**
 * 座標が範囲内にあるか判定
 */
export const coordinateInBounds = (coord: SpatialCoordinate, bounds: SpatialBounds): boolean =>
  coord.x >= bounds.minX && coord.x <= bounds.maxX && coord.z >= bounds.minZ && coord.z <= bounds.maxZ

/**
 * 2点間の距離計算
 */
export const calculateDistance = (a: SpatialCoordinate, b: SpatialCoordinate): number =>
  Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.z - b.z, 2))

// === Type Exports ===

export type {
  BiomePlacement,
  BiomeQuery,
  BiomeStatistics,
  BiomeSystemRepositoryConfig,
  ClimateGrid,
  ClimateTransition,
  SpatialBounds,
  SpatialCoordinate,
  SpatialQuery,
  SpatialQueryResult,
}
