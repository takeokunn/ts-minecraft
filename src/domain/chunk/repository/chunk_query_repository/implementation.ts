import { Clock, Effect, Layer, Match, Option, pipe, Random, ReadonlyArray, Ref } from 'effect'
import type { ChunkData } from '../../aggregate/chunk_data'
import type { ChunkPosition } from '../../value_object/chunk_position'
import type { ChunkRepository } from '../chunk_repository'
import type { RepositoryError } from '../types'
import { RepositoryErrors } from '../types'
import type {
  ChunkAnalytics,
  ChunkHeatmapData,
  ChunkNeighborhood,
  ChunkPerformanceStats,
  ChunkSearchCriteria,
} from './index'
import { ChunkQueryRepository } from './index'

/**
 * ChunkQueryRepository Implementation
 *
 * 読み取り専用の高性能クエリ操作を実装
 * ChunkRepositoryに依存し、複雑な検索・分析機能を提供
 */

// ===== Internal Types ===== //

interface QueryPerformanceMetric {
  readonly queryName: string
  readonly executionTimeMs: number
  readonly timestamp: number
  readonly memoryUsed: number
}

interface CacheEntry<T> {
  readonly data: T
  readonly timestamp: number
  readonly hitCount: number
}

type CacheValue = ReadonlyArray<ChunkData> | ReadonlyArray<ChunkPosition>

// ===== Helper Functions ===== //

/**
 * 距離計算（ユークリッド距離）
 */
const calculateDistance = (pos1: ChunkPosition, pos2: ChunkPosition): number =>
  Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.z - pos2.z, 2))

/**
 * 範囲内チェック
 */
const isInRange = (position: ChunkPosition, center: ChunkPosition, radius: number): boolean =>
  calculateDistance(position, center) <= radius

/**
 * バウンディングボックス内チェック
 */
const isInBoundingBox = (
  position: ChunkPosition,
  box: { minX: number; maxX: number; minZ: number; maxZ: number }
): boolean => position.x >= box.minX && position.x <= box.maxX && position.z >= box.minZ && position.z <= box.maxZ

/**
 * チャンクフィルタリング
 */
const applyFilters = (chunks: ReadonlyArray<ChunkData>, criteria: ChunkSearchCriteria): ReadonlyArray<ChunkData> => {
  // 座標フィルタ
  const positionFiltered = pipe(
    Option.fromNullable(criteria.positions),
    Option.match({
      onNone: () => chunks,
      onSome: (positions) => {
        const positionSet = new Set(positions.map((p) => `${p.x},${p.z}`))
        return chunks.filter((chunk) => positionSet.has(`${chunk.position.x},${chunk.position.z}`))
      },
    })
  )

  // バウンディングボックスフィルタ
  const boundingBoxFiltered = pipe(
    Option.fromNullable(criteria.boundingBox),
    Option.match({
      onNone: () => positionFiltered,
      onSome: (box) => positionFiltered.filter((chunk) => isInBoundingBox(chunk.position, box)),
    })
  )

  // 半径フィルタ
  const radiusFiltered = pipe(
    Option.fromNullable(criteria.radius),
    Option.match({
      onNone: () => boundingBoxFiltered,
      onSome: (radius) =>
        boundingBoxFiltered.filter((chunk) => isInRange(chunk.position, radius.center, radius.distance)),
    })
  )

  // 時間範囲フィルタ（メタデータベース）
  const timeRangeFiltered = pipe(
    Option.fromNullable(criteria.timeRange),
    Option.match({
      onNone: () => radiusFiltered,
      onSome: (_timeRange) =>
        radiusFiltered.filter((_chunk) => {
          // チャンクにタイムスタンプがある場合の処理
          // 実際の実装では chunk.metadata.timestamp などを参照
          return true // プレースホルダー
        }),
    })
  )

  // バイオームフィルタ
  const biomeFiltered = pipe(
    Option.fromNullable(criteria.biomeTypes),
    Option.match({
      onNone: () => timeRangeFiltered,
      onSome: (biomeTypes) =>
        biomeTypes.length === 0
          ? timeRangeFiltered
          : timeRangeFiltered.filter((_chunk) => {
              // チャンクのバイオーム情報を確認
              // 実際の実装では chunk.metadata.biome などを参照
              return true // プレースホルダー
            }),
    })
  )

  // ブロック型フィルタ
  return pipe(
    Option.fromNullable(criteria.hasBlocks),
    Option.match({
      onNone: () => biomeFiltered,
      onSome: (hasBlocks) =>
        hasBlocks.length === 0
          ? biomeFiltered
          : biomeFiltered.filter((_chunk) => {
              // チャンクに特定のブロックが含まれるかチェック
              // 実際の実装では chunk.blocks を検索
              return true // プレースホルダー
            }),
    })
  )
}

/**
 * ソート適用
 */
const applySorting = (
  chunks: ReadonlyArray<ChunkData>,
  sortBy?: 'createdAt' | 'modifiedAt' | 'accessCount' | 'size',
  sortOrder?: 'asc' | 'desc'
): ReadonlyArray<ChunkData> =>
  pipe(
    Option.fromNullable(sortBy),
    Option.match({
      onNone: () => chunks,
      onSome: (by) => {
        const sorted = [...chunks].sort((a, b) => {
          const comparison = pipe(
            Match.value(by),
            Match.when('createdAt', () => 0), // 実際の実装では chunk.metadata.createdAt を使用
            Match.when('modifiedAt', () => 0), // 実際の実装では chunk.metadata.modifiedAt を使用
            Match.when('accessCount', () => 0), // 実際の実装では chunk.metadata.accessCount を使用
            Match.when('size', () => JSON.stringify(a).length - JSON.stringify(b).length),
            Match.orElse(() => 0)
          )

          return sortOrder === 'desc' ? -comparison : comparison
        })

        return sorted
      },
    })
  )

/**
 * ページネーション適用
 */
const applyPagination = (
  chunks: ReadonlyArray<ChunkData>,
  limit?: number,
  offset?: number
): ReadonlyArray<ChunkData> => {
  const afterOffset = pipe(
    Option.fromNullable(offset),
    Option.match({
      onNone: () => chunks,
      onSome: (o) => chunks.slice(o),
    })
  )

  return pipe(
    Option.fromNullable(limit),
    Option.match({
      onNone: () => afterOffset,
      onSome: (l) => afterOffset.slice(0, l),
    })
  )
}

// ===== Repository Implementation ===== //

/**
 * ChunkQueryRepository Live Implementation
 */
export const ChunkQueryRepositoryLive = Layer.effect(
  ChunkQueryRepository,
  Effect.gen(function* () {
    const chunkRepo = yield* ChunkRepository

    // パフォーマンス測定用の状態
    const performanceMetricsRef = yield* Ref.make<ReadonlyArray<QueryPerformanceMetric>>([])

    // 簡易キャッシュ
    const cacheRef = yield* Ref.make<Map<string, CacheEntry<CacheValue>>>(new Map())

    // キャッシュヘルパー
    const getCached = <T>(key: string, ttlMs: number = 60000): Effect.Effect<T | null, never> =>
      Effect.gen(function* () {
        const cache = yield* Ref.get(cacheRef)
        // Map<string, CacheEntry<CacheValue>>からCacheEntry<T>への型安全な取得
        const entry = cache.get(key) as CacheEntry<T> | undefined

        return yield* pipe(
          Option.fromNullable(entry),
          Option.match({
            onNone: () => Effect.succeed(null),
            onSome: (e) =>
              Effect.gen(function* () {
                const now = yield* Clock.currentTimeMillis

                return yield* pipe(
                  Match.value(now - e.timestamp < ttlMs),
                  Match.when(
                    (isFresh) => isFresh,
                    () =>
                      Effect.gen(function* () {
                        yield* Ref.update(cacheRef, (currentCache) => {
                          const newCache = new Map(currentCache)
                          newCache.set(key, { ...e, hitCount: e.hitCount + 1 })
                          return newCache
                        })
                        return e.data as T | null
                      })
                  ),
                  Match.orElse(() => Effect.succeed(null))
                )
              }),
          })
        )
      })

    const setCache = <T>(key: string, data: T): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        yield* Ref.update(cacheRef, (cache) => {
          const newCache = new Map(cache)
          newCache.set(key, {
            data,
            timestamp: now,
            hitCount: 0,
          })
          return newCache
        })
      })

    return {
      // ===== Basic Query Operations ===== //

      findChunksInRadius: (center: ChunkPosition, radius: number) =>
        Effect.gen(function* () {
          const cacheKey = `radius_${center.x}_${center.z}_${radius}`
          const cached = yield* getCached<ReadonlyArray<ChunkData>>(cacheKey)

          return yield* pipe(
            Option.fromNullable(cached),
            Option.match({
              onNone: () =>
                Effect.gen(function* () {
                  // 範囲を計算してその領域のチャンクを取得
                  const region = {
                    minX: Math.floor(center.x - radius),
                    maxX: Math.ceil(center.x + radius),
                    minZ: Math.floor(center.z - radius),
                    maxZ: Math.ceil(center.z + radius),
                  }

                  const regionChunks = yield* chunkRepo.findByRegion(region)

                  const result = regionChunks.filter((chunk) => isInRange(chunk.position, center, radius))

                  yield* setCache(cacheKey, result)
                  return result
                }),
              onSome: (cachedData) => Effect.succeed(cachedData),
            })
          )
        }),

      findEmptyChunks: (region) =>
        Effect.gen(function* () {
          const cacheKey = region ? `empty_${region.minX}_${region.maxX}_${region.minZ}_${region.maxZ}` : 'empty_all'

          const cached = yield* getCached<ReadonlyArray<ChunkPosition>>(cacheKey)

          return yield* pipe(
            Option.fromNullable(cached),
            Option.match({
              onNone: () =>
                Effect.gen(function* () {
                  // 全チャンクから空のチャンクを検索
                  // 実際の実装では、チャンクの中身をチェックして空かどうかを判定
                  const allChunks = region ? yield* chunkRepo.findByRegion(region) : yield* chunkRepo.findByQuery({})

                  // ReadonlyArray関数で空チャンクフィルタリング
                  const emptyPositions = pipe(
                    allChunks,
                    ReadonlyArray.filter((chunk) => JSON.stringify(chunk).length < 1000),
                    ReadonlyArray.map((chunk) => chunk.position)
                  )

                  yield* setCache(cacheKey, emptyPositions)
                  return emptyPositions
                }),
              onSome: (cachedData) => Effect.succeed(cachedData),
            })
          )
        }),

      findChunksByBiome: (biomeType: string) =>
        Effect.gen(function* () {
          const cacheKey = `biome_${biomeType}`
          const cached = yield* getCached<ReadonlyArray<ChunkData>>(cacheKey)

          return yield* pipe(
            Option.fromNullable(cached),
            Option.match({
              onNone: () =>
                Effect.gen(function* () {
                  const allChunks = yield* chunkRepo.findByQuery({})

                  const result = allChunks.filter((chunk) => {
                    // チャンクのバイオーム情報をチェック
                    // 実際の実装では chunk.metadata.biome を参照
                    return true // プレースホルダー
                  })

                  yield* setCache(cacheKey, result)
                  return result
                }),
              onSome: (cachedData) => Effect.succeed(cachedData),
            })
          )
        }),

      findModifiedChunks: (since: number) =>
        Effect.gen(function* () {
          return yield* chunkRepo.findModified(since)
        }),

      findMostAccessedChunks: (limit: number) =>
        Effect.gen(function* () {
          const allChunks = yield* chunkRepo.findByQuery({})

          // アクセス回数でソート（メタデータベース）
          const sorted = [...allChunks]
            .sort((a, b) => {
              // 実際の実装では chunk.metadata.accessCount を使用
              return 0 // プレースホルダー
            })
            .slice(0, limit)

          return sorted
        }),

      findChunksContainingBlock: (blockType: string) =>
        Effect.gen(function* () {
          const cacheKey = `block_${blockType}`
          const cached = yield* getCached<ReadonlyArray<ChunkData>>(cacheKey)

          return yield* pipe(
            Option.fromNullable(cached),
            Option.match({
              onNone: () =>
                Effect.gen(function* () {
                  const allChunks = yield* chunkRepo.findByQuery({})

                  const result = allChunks.filter((chunk) => {
                    // チャンクに特定のブロックタイプが含まれるかチェック
                    // 実際の実装では chunk.blocks を検索
                    return true // プレースホルダー
                  })

                  yield* setCache(cacheKey, result)
                  return result
                }),
              onSome: (cachedData) => Effect.succeed(cachedData),
            })
          )
        }),

      // ===== Advanced Search Operations ===== //

      searchChunks: (criteria: ChunkSearchCriteria) =>
        Effect.gen(function* () {
          const allChunks = yield* chunkRepo.findByQuery({})

          let filtered = applyFilters(allChunks, criteria)
          filtered = applySorting(filtered, criteria.sortBy, criteria.sortOrder)
          filtered = applyPagination(filtered, criteria.limit, criteria.offset)

          return filtered
        }),

      fullTextSearch: (query: string) =>
        Effect.gen(function* () {
          const allChunks = yield* chunkRepo.findByQuery({})

          // メタデータ内での全文検索
          const result = allChunks.filter((chunk) => {
            const searchableText = JSON.stringify(chunk).toLowerCase()
            return searchableText.includes(query.toLowerCase())
          })

          return result
        }),

      findNearbyChunks: (position: ChunkPosition, maxDistance: number, filters) =>
        Effect.gen(function* () {
          const nearbyChunks = yield* Effect.succeed([]).pipe(
            Effect.flatMap(() =>
              chunkRepo.findByRegion({
                minX: Math.floor(position.x - maxDistance),
                maxX: Math.ceil(position.x + maxDistance),
                minZ: Math.floor(position.z - maxDistance),
                maxZ: Math.ceil(position.z + maxDistance),
              })
            )
          )

          let filtered = nearbyChunks.filter((chunk) => calculateDistance(chunk.position, position) <= maxDistance)

          return yield* pipe(
            Option.fromNullable(filters),
            Option.match({
              onNone: () => Effect.succeed(filtered),
              onSome: (f) => Effect.succeed(applyFilters(filtered, f)),
            })
          )
        }),

      getChunkNeighborhood: (position: ChunkPosition, radius = 1) =>
        Effect.gen(function* () {
          const centerChunk = yield* chunkRepo.findByPosition(position)

          const center = yield* pipe(
            centerChunk,
            Effect.filterOrFail(
              (chunk) => chunk._tag === 'Some',
              () => RepositoryErrors.chunkNotFound(`${position.x},${position.z}`)
            ),
            Effect.map((chunk) => chunk.value)
          )

          // 隣接チャンクを取得
          const neighbors = {
            north: yield* chunkRepo.findByPosition({ x: position.x, z: position.z + 1 }),
            south: yield* chunkRepo.findByPosition({ x: position.x, z: position.z - 1 }),
            east: yield* chunkRepo.findByPosition({ x: position.x + 1, z: position.z }),
            west: yield* chunkRepo.findByPosition({ x: position.x - 1, z: position.z }),
            northeast: yield* chunkRepo.findByPosition({ x: position.x + 1, z: position.z + 1 }),
            northwest: yield* chunkRepo.findByPosition({ x: position.x - 1, z: position.z + 1 }),
            southeast: yield* chunkRepo.findByPosition({ x: position.x + 1, z: position.z - 1 }),
            southwest: yield* chunkRepo.findByPosition({ x: position.x - 1, z: position.z - 1 }),
          }

          // 半径2、3の範囲のチャンクを取得
          const radius2Chunks = yield* chunkRepo.findByRegion({
            minX: position.x - 2,
            maxX: position.x + 2,
            minZ: position.z - 2,
            maxZ: position.z + 2,
          })

          const radius3Chunks = yield* chunkRepo.findByRegion({
            minX: position.x - 3,
            maxX: position.x + 3,
            minZ: position.z - 3,
            maxZ: position.z + 3,
          })

          // Option値をundefinedへ変換
          const extractValue = (opt: Option.Option<ChunkData>) => (Option.isSome(opt) ? opt.value : undefined)

          const neighborhood: ChunkNeighborhood = {
            center,
            neighbors: {
              north: extractValue(neighbors.north),
              south: extractValue(neighbors.south),
              east: extractValue(neighbors.east),
              west: extractValue(neighbors.west),
              northeast: extractValue(neighbors.northeast),
              northwest: extractValue(neighbors.northwest),
              southeast: extractValue(neighbors.southeast),
              southwest: extractValue(neighbors.southwest),
            },
            radius2: radius2Chunks,
            radius3: radius3Chunks,
          }

          return neighborhood
        }),

      // ===== Analytics and Statistics ===== //

      getAnalytics: (timeRange) =>
        Effect.gen(function* () {
          const stats = yield* chunkRepo.getStatistics()

          const analytics: ChunkAnalytics = {
            totalChunks: stats.totalChunks,
            loadedChunks: stats.loadedChunks,
            unloadedChunks: stats.totalChunks - stats.loadedChunks,
            loadingChunks: 0, // 実際の実装では状態管理から取得
            errorChunks: 0, // 実際の実装では状態管理から取得
            averageLoadTime: stats.averageLoadTime,
            memoryUsageByRegion: [], // 実際の実装では地域別に計算
            accessPatterns: [], // 実際の実装では使用パターンを分析
            biomeDistribution: [], // 実際の実装ではバイオーム分布を計算
          }

          return analytics
        }),

      getPerformanceStats: () =>
        Effect.gen(function* () {
          const metrics = yield* Ref.get(performanceMetricsRef)

          const stats: ChunkPerformanceStats = {
            queryExecutionTimes: metrics.map((m) => ({
              query: m.queryName,
              executionTimeMs: m.executionTimeMs,
              timestamp: m.timestamp,
            })),
            cacheHitRates: [], // 実際の実装ではキャッシュ統計を計算
            memoryPressure: {
              currentUsageMB: 0, // 実際の実装ではメモリ使用量を測定
              maxUsageMB: 1024,
              pressureLevel: 'low',
            },
            ioPerformance: {
              averageReadTimeMs: 10,
              averageWriteTimeMs: 15,
              queueDepth: 0,
            },
          }

          return stats
        }),

      getRegionalStatistics: (regions) =>
        Effect.gen(function* () {
          // Effect.forEachで並行実行可能な統計計算
          return yield* Effect.forEach(
            regions,
            (region) =>
              Effect.gen(function* () {
                const chunks = yield* chunkRepo.findByRegion(region)
                const loadedCount = chunks.length // 実際の実装では状態をチェック

                return {
                  region,
                  chunkCount: chunks.length,
                  loadedCount,
                  memoryUsage: chunks.length * 64 * 1024, // 簡易推定
                  averageAccessTime: 10, // 簡易推定
                }
              }),
            { concurrency: 4 }
          )
        }),

      generateHeatmap: (region, metric) =>
        Effect.gen(function* () {
          const chunks = yield* chunkRepo.findByRegion(region)

          const data = chunks.map((chunk) => {
            const value = pipe(
              Match.value(metric),
              Match.when('accessCount', () => 1), // 実際の実装では chunk.metadata.accessCount
              Match.when('loadTime', () => 10), // 実際の実装では chunk.metadata.loadTime
              Match.when('modificationTime', () => 0), // 実際の実装では chunk.metadata.modifiedAt（プレースホルダー）
              Match.when('size', () => JSON.stringify(chunk).length),
              Match.exhaustive
            )

            return {
              x: chunk.position.x,
              z: chunk.position.z,
              value,
              metadata: {
                loadTime: 10,
                accessCount: 1,
                lastModified: 0, // プレースホルダー（実際の実装ではchunk.metadata.modifiedAtを使用）
              },
            }
          })

          const values = data.map((d) => d.value)
          const min = Math.min(...values)
          const max = Math.max(...values)

          const heatmap: ChunkHeatmapData = {
            region,
            data,
            scale: {
              min,
              max,
              unit: metric === 'size' ? 'bytes' : metric === 'loadTime' ? 'ms' : 'count',
            },
          }

          return heatmap
        }),

      // ===== Aggregation Operations ===== //

      getBiomeDistribution: (region) =>
        Effect.gen(function* () {
          const chunks = region ? yield* chunkRepo.findByRegion(region) : yield* chunkRepo.findByQuery({})

          // バイオーム分布計算（プレースホルダー）
          const distribution = [
            { biomeType: 'plains', chunkCount: Math.floor(chunks.length * 0.4), percentage: 40 },
            { biomeType: 'forest', chunkCount: Math.floor(chunks.length * 0.3), percentage: 30 },
            { biomeType: 'mountains', chunkCount: Math.floor(chunks.length * 0.2), percentage: 20 },
            { biomeType: 'desert', chunkCount: Math.floor(chunks.length * 0.1), percentage: 10 },
          ]

          return distribution
        }),

      getBlockTypeDistribution: (region) =>
        Effect.gen(function* () {
          const chunks = region ? yield* chunkRepo.findByRegion(region) : yield* chunkRepo.findByQuery({})

          // ブロック型分布計算（プレースホルダー）
          const distribution = [
            { blockType: 'stone', count: chunks.length * 1000, percentage: 50 },
            { blockType: 'dirt', count: chunks.length * 600, percentage: 30 },
            { blockType: 'grass', count: chunks.length * 400, percentage: 20 },
          ]

          return distribution
        }),

      getTimeSeriesStats: (metric, interval, timeRange) =>
        Effect.gen(function* () {
          // 時系列統計計算（プレースホルダー）
          const intervalMs = interval === 'hourly' ? 3600000 : interval === 'daily' ? 86400000 : 604800000

          // 数値範囲をReadonlyArray.makeByで生成
          const timeSteps = Math.floor((timeRange.to - timeRange.from) / intervalMs) + 1
          const timestamps = ReadonlyArray.makeBy(timeSteps, (i) => timeRange.from + i * intervalMs)

          // プレースホルダー値をRandom Serviceで生成
          const dataPoints = yield* Effect.forEach(timestamps, (timestamp) =>
            Random.nextIntBetween(0, 100).pipe(Effect.map((value) => ({ timestamp, value })))
          )

          return dataPoints
        }),

      // ===== Optimization and Maintenance Queries ===== //

      findOptimizationCandidates: () =>
        Effect.gen(function* () {
          const allChunks = yield* chunkRepo.findByQuery({})

          // 各チャンクの優先度をRandom Serviceで生成
          const candidatesWithPriority = yield* Effect.forEach(allChunks, (chunk) =>
            Random.nextIntBetween(1, 11).pipe(
              Effect.map((priority) => ({
                chunk,
                reason: 'メモリ使用量が高い', // 実際の実装では分析ロジック
                priority, // 実際の実装では優先度計算
              }))
            )
          )

          const candidates = candidatesWithPriority.filter((c) => c.priority > 5)

          return candidates
        }),

      findOrphanedChunks: () =>
        Effect.gen(function* () {
          const allChunks = yield* chunkRepo.findByQuery({})

          // 孤立チャンク検出ロジック（隣接チャンクがないもの）
          // Effect.filterで並行チェック
          return yield* Effect.filter(
            allChunks,
            (chunk) =>
              Effect.gen(function* () {
                const neighbors = yield* chunkRepo.findByRegion({
                  minX: chunk.position.x - 1,
                  maxX: chunk.position.x + 1,
                  minZ: chunk.position.z - 1,
                  maxZ: chunk.position.z + 1,
                })
                // 自分だけの場合は孤立
                return neighbors.length === 1
              }),
            { concurrency: 4 }
          )
        }),

      findMemoryPressureCauses: () =>
        Effect.gen(function* () {
          const allChunks = yield* chunkRepo.findByQuery({})

          const causes = allChunks
            .map((chunk) => {
              const memoryUsage = JSON.stringify(chunk).length
              return {
                chunk,
                memoryUsage,
                reason: memoryUsage > 10000 ? '大きなデータサイズ' : '正常',
              }
            })
            .filter((c) => c.memoryUsage > 5000)

          return causes
        }),

      // ===== Real-time Monitoring ===== //

      monitorActiveChunks: () =>
        Effect.gen(function* () {
          const recentChunks = yield* chunkRepo.findRecentlyLoaded(50)
          const now = yield* Clock.currentTimeMillis

          const active = recentChunks.map((chunk) => ({
            chunk,
            lastActivity: now,
            activityType: 'load', // 実際の実装では活動タイプを判定
          }))

          return active
        }),

      measureQueryPerformance: <T>(queryName: string, query: Effect.Effect<T, RepositoryError>) =>
        Effect.gen(function* () {
          const startTime = yield* Clock.currentTimeMillis
          const startMemory = process.memoryUsage().heapUsed

          const result = yield* query

          const endTime = yield* Clock.currentTimeMillis
          const endMemory = process.memoryUsage().heapUsed

          const executionTimeMs = endTime - startTime
          const memoryUsed = endMemory - startMemory

          const now = yield* Clock.currentTimeMillis
          // パフォーマンスメトリクスを記録
          yield* Ref.update(performanceMetricsRef, (metrics) => [
            ...metrics.slice(-99), // 最新100件を保持
            {
              queryName,
              executionTimeMs,
              timestamp: now,
              memoryUsed,
            },
          ])

          return {
            result,
            executionTimeMs,
            memoryUsed,
          }
        }),
    }
  })
)
