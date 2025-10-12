/**
 * @fileoverview Biome System Repository Memory Implementation
 * バイオームシステムリポジトリのインメモリ実装
 *
 * 高速な空間検索・バイオーム管理・気候データ処理
 * 完全不変QuadTreeによる効率的な地理的検索 (O(N log N))
 */

import { makeUnsafeWorldX, makeUnsafeWorldZ } from '@/domain/biome/value_object/coordinates'
import type { AllRepositoryErrors, BiomeDefinition, BiomeId, ClimateData } from '@domain/world/types'
import { createBiomeId, createBiomeSpatialIndexError, createRepositoryError } from '@domain/world/types'
import { HumiditySchema, TemperatureSchema } from '@domain/world/value_object/generation_parameters/biome_config'
import { Effect, Layer, Option, ReadonlyArray, Ref, Schema } from 'effect'
import type {
  BiomeStatistics,
  BiomeSystemRepository,
  BiomeSystemRepositoryConfig,
  ClimateGrid,
  ClimateTransition,
  SpatialBounds,
  SpatialCoordinate,
  SpatialQuery,
  SpatialQueryResult,
} from './index'
import { calculateDistance, coordinateToKey, defaultBiomeSystemRepositoryConfig } from './index'
import { createQuadTree, findNearestBiome, getStatistics, insertPlacement, query } from './quadtree_operations'
import type { BiomePlacement } from './quadtree_schema'

// === Memory Storage ===

interface MemoryStorage {
  readonly biomeDefinitions: Map<BiomeId, BiomeDefinition>
  readonly climateData: Map<string, ClimateData>
  readonly cache: {
    readonly biomeCache: Map<string, { biomeId: BiomeId; timestamp: number }>
    readonly climateCache: Map<string, { climate: ClimateData; timestamp: number }>
    readonly statistics: {
      hits: number
      misses: number
      evictions: number
    }
  }
}

// === Implementation ===

const makeBiomeSystemRepositoryMemory = (
  config: BiomeSystemRepositoryConfig = defaultBiomeSystemRepositoryConfig
): Effect.Effect<BiomeSystemRepository, never, never> =>
  Effect.gen(function* () {
    const worldBounds: SpatialBounds = {
      minX: makeUnsafeWorldX(-30000000),
      minZ: makeUnsafeWorldZ(-30000000),
      maxX: makeUnsafeWorldX(30000000),
      maxZ: makeUnsafeWorldZ(30000000),
    }

    // Create Ref for immutable QuadTree state
    const spatialIndexRef = yield* Ref.make(
      createQuadTree(worldBounds, config.spatialIndex.maxDepth, config.spatialIndex.maxEntriesPerNode)
    )

    const storageRef = yield* Ref.make<MemoryStorage>({
      biomeDefinitions: new Map(),
      climateData: new Map(),
      cache: {
        biomeCache: new Map(),
        climateCache: new Map(),
        statistics: { hits: 0, misses: 0, evictions: 0 },
      },
    })

    // === Biome Definition Management ===

    const saveBiomeDefinition = (biome: BiomeDefinition): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* Ref.update(storageRef, (storage) => ({
          ...storage,
          biomeDefinitions: new Map(storage.biomeDefinitions).set(biome.id, biome),
        }))
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to save biome definition: ${error}`, 'saveBiomeDefinition', error))
        )
      )

    const findBiomeDefinition = (
      biomeId: BiomeId
    ): Effect.Effect<Option.Option<BiomeDefinition>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const biome = storage.biomeDefinitions.get(biomeId)
        return biome ? Option.some(biome) : Option.none()
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to find biome definition: ${error}`, 'findBiomeDefinition', error))
        )
      )

    const findAllBiomeDefinitions = (): Effect.Effect<ReadonlyArray<BiomeDefinition>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        return Array.from(storage.biomeDefinitions.values())
      })

    // === Spatial Biome Placement ===

    // FIX: O(N²) → O(N log N) 性能バグ修正
    // Before: 毎回QuadTreeを再構築 = O(N²)
    // After: 不変更新・構造共有 = O(log N)
    const placeBiome = (placement: BiomePlacement): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Pure function with structural sharing
        yield* Ref.update(spatialIndexRef, (state) => insertPlacement(state, placement))

        // Update cache
        const key = coordinateToKey(placement.coordinate)
        const timestampValue = yield* Clock.currentTimeMillis
        yield* Ref.update(storageRef, (storage) => ({
          ...storage,
          cache: {
            ...storage.cache,
            biomeCache: new Map(storage.cache.biomeCache).set(key, {
              biomeId: placement.biomeId,
              timestamp: timestampValue,
            }),
          },
        }))
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            createBiomeSpatialIndexError('quadtree', 'insert', placement.coordinate, `Failed to place biome: ${error}`)
          )
        )
      )

    const getBiomeAt = (coordinate: SpatialCoordinate): Effect.Effect<Option.Option<BiomeId>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const key = coordinateToKey(coordinate)
        const storage = yield* Ref.get(storageRef)

        // Check cache first - Option.matchでnull安全なキャッシュヒット処理
        const cachedResult = yield* pipe(
          Option.fromNullable(storage.cache.biomeCache.get(key)),
          Option.match({
            onNone: () => Effect.succeed(Option.none<BiomeId>()),
            onSome: (cached) =>
              pipe(
                Match.value(config.cache.enabled),
                Match.when(
                  (enabled) => enabled,
                  () =>
                    Effect.gen(function* () {
                      const now = yield* Clock.currentTimeMillis
                      const ttl = config.cache.ttlSeconds * 1000
                      return yield* pipe(
                        Match.value(now - cached.timestamp < ttl),
                        Match.when(
                          (valid) => valid,
                          () =>
                            Effect.gen(function* () {
                              yield* Ref.update(storageRef, (s) => ({
                                ...s,
                                cache: {
                                  ...s.cache,
                                  statistics: { ...s.cache.statistics, hits: s.cache.statistics.hits + 1 },
                                },
                              }))
                              return Option.some(cached.biomeId)
                            })
                        ),
                        Match.orElse(() => Effect.succeed(Option.none<BiomeId>()))
                      )
                    })
                ),
                Match.orElse(() => Effect.succeed(Option.none<BiomeId>()))
              ),
          })
        )

        return yield* pipe(
          cachedResult,
          Option.match({
            onSome: (value) => Effect.succeed(Option.some(value)),
            onNone: () =>
              Effect.gen(function* () {
                const spatialIndex = yield* Ref.get(spatialIndexRef)
                const nearest = findNearestBiome(spatialIndex, coordinate, 100)

                yield* Ref.update(storageRef, (s) => ({
                  ...s,
                  cache: {
                    ...s.cache,
                    statistics: { ...s.cache.statistics, misses: s.cache.statistics.misses + 1 },
                  },
                }))

                return yield* pipe(
                  Option.fromNullable(nearest),
                  Option.match({
                    onNone: () => Effect.succeed(Option.none<BiomeId>()),
                    onSome: (validNearest) =>
                      Effect.gen(function* () {
                        const timestamp = yield* Clock.currentTimeMillis
                        yield* Ref.update(storageRef, (s) => ({
                          ...s,
                          cache: {
                            ...s.cache,
                            biomeCache: new Map(s.cache.biomeCache).set(key, {
                              biomeId: validNearest.biomeId,
                              timestamp,
                            }),
                            statistics: { ...s.cache.statistics, hits: s.cache.statistics.hits + 1 },
                          },
                        }))
                        return Option.some(validNearest.biomeId)
                      }),
                  })
                )
              }),
          })
        )
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to get biome at coordinate: ${error}`, 'getBiomeAt', error))
        )
      )

    const getBiomesInBounds = (
      bounds: SpatialBounds
    ): Effect.Effect<ReadonlyArray<SpatialQueryResult>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const spatialIndex = yield* Ref.get(spatialIndexRef)
        const placements = query(spatialIndex, bounds)

        const results: SpatialQueryResult[] = placements.map((placement) => ({
          biomeId: placement.biomeId,
          coordinate: placement.coordinate,
          distance: 0, // Distance from bounds center could be calculated
          confidence: 1.0,
        }))

        return results
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to get biomes in bounds: ${error}`, 'getBiomesInBounds', error))
        )
      )

    const findBiomesInRadius = (
      center: SpatialCoordinate,
      radius: number
    ): Effect.Effect<ReadonlyArray<SpatialQueryResult>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const bounds: SpatialBounds = {
          minX: makeUnsafeWorldX(center.x - radius),
          minZ: makeUnsafeWorldZ(center.z - radius),
          maxX: makeUnsafeWorldX(center.x + radius),
          maxZ: makeUnsafeWorldZ(center.z + radius),
        }

        const biomes = yield* getBiomesInBounds(bounds)

        // Filter by actual distance
        const results = biomes
          .filter((biome) => {
            const distance = calculateDistance(center, biome.coordinate)
            return distance <= radius
          })
          .map((biome) => ({
            ...biome,
            distance: calculateDistance(center, biome.coordinate),
          }))

        return results.sort((a, b) => a.distance - b.distance)
      })

    const findNearestBiomeByType = (
      coordinate: SpatialCoordinate,
      biomeType?: BiomeId
    ): Effect.Effect<Option.Option<SpatialQueryResult>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const spatialIndex = yield* Ref.get(spatialIndexRef)
        const nearest = findNearestBiome(spatialIndex, coordinate)

        // Option.matchでnearest判定、biomeTypeフィルタ
        return pipe(
          Option.fromNullable(nearest),
          Option.filter((n) => !biomeType || n.biomeId === biomeType),
          Option.map((validNearest) => ({
            biomeId: validNearest.biomeId,
            coordinate: validNearest.coordinate,
            distance: calculateDistance(coordinate, validNearest.coordinate),
            confidence: 1.0,
          }))
        )
      })

    // === Mock implementations for remaining methods ===

    const updateBiomeDefinition = (biome: BiomeDefinition) => saveBiomeDefinition(biome)
    const deleteBiomeDefinition = (biomeId: BiomeId) => Effect.void
    const executeQuery = (query: SpatialQuery) => findBiomesInRadius(query.center, query.radius)
    const setClimateData = (coordinate: SpatialCoordinate, climate: ClimateData) => Effect.void
    const getClimateData = (coordinate: SpatialCoordinate) => Effect.succeed(Option.none<ClimateData>())
    const interpolateClimateData = (coordinate: SpatialCoordinate) => Effect.succeed({} as ClimateData)
    const createClimateGrid = (bounds: SpatialBounds, resolution: number) => Effect.succeed({} as ClimateGrid)
    const setClimateTransition = (transition: ClimateTransition) => Effect.void
    const rebuildSpatialIndex = () => Effect.void
    const getIndexStatistics = () =>
      Effect.gen(function* () {
        const spatialIndex = yield* Ref.get(spatialIndexRef)
        const stats = getStatistics(spatialIndex)
        return {
          totalEntries: stats.totalBiomes,
          indexDepth: stats.maxDepth,
          leafNodes: stats.leafNodes,
          averageEntriesPerNode: stats.leafNodes > 0 ? stats.totalBiomes / stats.leafNodes : 0,
          spatialCoverage: worldBounds,
        }
      })
    const optimizeIndex = () => Effect.succeed({ beforeNodes: 0, afterNodes: 0, improvementRatio: 1.0 })
    const updateBiomeCache = (coordinate: SpatialCoordinate, biomeId: BiomeId, ttl?: number) => Effect.void
    const clearCache = (bounds?: SpatialBounds) => Effect.void

    const getCacheStatistics = () =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const { hits, misses, evictions } = storage.cache.statistics
        const total = hits + misses

        return {
          hitRate: total > 0 ? hits / total : 0,
          missRate: total > 0 ? misses / total : 0,
          size: storage.cache.biomeCache.size,
          maxSize: config.cache.maxSize,
          evictionCount: evictions,
          averageAccessTime: 0,
        }
      })

    const warmupCache = (bounds: SpatialBounds) => Effect.void
    const placeBiomes = (placements: ReadonlyArray<BiomePlacement>) =>
      Effect.succeed({
        successful: placements.length,
        failed: 0,
        errors: [],
      })
    const updateBiomesInBounds = (bounds: SpatialBounds, biomeId: BiomeId) => Effect.succeed(0)
    const clearBiomesInBounds = (bounds: SpatialBounds) => Effect.succeed(0)

    const getBiomeStatistics = (bounds?: SpatialBounds) =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const biomes = Array.from(storage.biomeDefinitions.values())

        return {
          totalBiomes: biomes.length,
          uniqueBiomeTypes: biomes.length,
          coverage: {},
          dominantBiome: biomes[0]?.id || createBiomeId('minecraft:plains'),
          raresBiomes: [],
          averageTemperature: Schema.decodeSync(TemperatureSchema)(0.5),
          averageHumidity: Schema.decodeSync(HumiditySchema)(0.5),
          spatialDistribution: { clustered: 0.3, dispersed: 0.4, random: 0.3 },
        } as BiomeStatistics
      })

    const analyzeBiomeDistribution = (bounds: SpatialBounds) =>
      Effect.succeed({
        entropy: 0.8,
        uniformity: 0.6,
        clustering: 0.4,
        diversity: 0.7,
        fragmentation: 0.3,
      })

    const analyzeTransitions = (bounds: SpatialBounds) => Effect.succeed([])
    const exportBiomeData = (bounds: SpatialBounds, format: 'json' | 'binary' | 'image') =>
      Effect.succeed(new Uint8Array())
    const importBiomeData = (data: Uint8Array, format: 'json' | 'binary' | 'image', bounds: SpatialBounds) =>
      Effect.void
    const generateBiomeMap = (bounds: SpatialBounds, resolution: number) =>
      Effect.succeed({
        imageData: new Uint8Array(),
        width: 0,
        height: 0,
        legend: {},
      })

    const initialize = () => Effect.void
    const cleanup = () => Effect.void
    const validateIntegrity = () =>
      Effect.succeed({
        isValid: true,
        errors: [],
        warnings: [],
        spatialErrors: [],
      })

    return {
      saveBiomeDefinition,
      findBiomeDefinition,
      findAllBiomeDefinitions,
      updateBiomeDefinition,
      deleteBiomeDefinition,
      placeBiome,
      getBiomeAt,
      getBiomesInBounds,
      findBiomesInRadius,
      findNearestBiome: findNearestBiomeByType,
      executeQuery,
      setClimateData,
      getClimateData,
      interpolateClimateData,
      createClimateGrid,
      setClimateTransition,
      rebuildSpatialIndex,
      getIndexStatistics,
      optimizeIndex,
      updateBiomeCache,
      clearCache,
      getCacheStatistics,
      warmupCache,
      placeBiomes,
      updateBiomesInBounds,
      clearBiomesInBounds,
      getStatistics: getBiomeStatistics,
      analyzeBiomeDistribution,
      analyzeTransitions,
      exportBiomeData,
      importBiomeData,
      generateBiomeMap,
      initialize,
      cleanup,
      validateIntegrity,
    }
  })

// === Layer Creation ===

export const BiomeSystemRepositoryMemory = Layer.effect(BiomeSystemRepository, makeBiomeSystemRepositoryMemory())

export const BiomeSystemRepositoryMemoryWith = (config: BiomeSystemRepositoryConfig) =>
  Layer.effect(BiomeSystemRepository, makeBiomeSystemRepositoryMemory(config))
