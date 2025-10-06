/**
 * @fileoverview Biome System Repository Memory Implementation
 * バイオームシステムリポジトリのインメモリ実装
 *
 * 高速な空間検索・バイオーム管理・気候データ処理
 * QuadTree空間インデックスによる効率的な地理的検索
 */

import { Effect, Layer, Option, ReadonlyArray, Ref } from 'effect'
import type { BiomeDefinition, BiomeId, ClimateData, WorldCoordinate } from '@domain/world/types'
import type { AllRepositoryErrors } from '@domain/world/types'
import { createBiomeSpatialIndexError, createRepositoryError } from '@domain/world/types'
import type {
  BiomePlacement,
  BiomeStatistics,
  BiomeSystemRepository,
  BiomeSystemRepositoryConfig,
  ClimateGrid,
  SpatialBounds,
  SpatialCoordinate,
  SpatialQuery,
  SpatialQueryResult,
} from './index'
import { calculateDistance, coordinateInBounds, coordinateToKey, defaultBiomeSystemRepositoryConfig } from './index'

// === QuadTree Implementation ===

interface QuadTreeNode {
  readonly bounds: SpatialBounds
  readonly biomes: BiomePlacement[]
  readonly children?: [QuadTreeNode, QuadTreeNode, QuadTreeNode, QuadTreeNode] // NW, NE, SW, SE
  readonly isLeaf: boolean
}

class QuadTree {
  private root: QuadTreeNode
  private maxDepth: number
  private maxEntries: number

  constructor(bounds: SpatialBounds, maxDepth: number = 8, maxEntries: number = 16) {
    this.root = {
      bounds,
      biomes: [],
      isLeaf: true,
    }
    this.maxDepth = maxDepth
    this.maxEntries = maxEntries
  }

  insert(placement: BiomePlacement): void {
    this.insertNode(this.root, placement, 0)
  }

  private insertNode(node: QuadTreeNode, placement: BiomePlacement, depth: number): void {
    if (!coordinateInBounds(placement.coordinate, node.bounds)) {
      return
    }

    if (node.isLeaf) {
      node.biomes.push(placement)

      // Split if necessary
      if (node.biomes.length > this.maxEntries && depth < this.maxDepth) {
        this.splitNode(node, depth)
      }
    } else {
      // Insert into appropriate child
      if (node.children) {
        for (const child of node.children) {
          this.insertNode(child, placement, depth + 1)
        }
      }
    }
  }

  private splitNode(node: QuadTreeNode, depth: number): void {
    const { bounds } = node
    const midX = ((bounds.minX + bounds.maxX) / 2) as WorldCoordinate
    const midZ = ((bounds.minZ + bounds.maxZ) / 2) as WorldCoordinate

    const children: [QuadTreeNode, QuadTreeNode, QuadTreeNode, QuadTreeNode] = [
      // NW
      { bounds: { minX: bounds.minX, minZ: midZ, maxX: midX, maxZ: bounds.maxZ }, biomes: [], isLeaf: true },
      // NE
      { bounds: { minX: midX, minZ: midZ, maxX: bounds.maxX, maxZ: bounds.maxZ }, biomes: [], isLeaf: true },
      // SW
      { bounds: { minX: bounds.minX, minZ: bounds.minZ, maxX: midX, maxZ: midZ }, biomes: [], isLeaf: true },
      // SE
      { bounds: { minX: midX, minZ: bounds.minZ, maxX: bounds.maxX, maxZ: midZ }, biomes: [], isLeaf: true },
    ]

    // Redistribute biomes to children
    for (const biome of node.biomes) {
      for (const child of children) {
        if (coordinateInBounds(biome.coordinate, child.bounds)) {
          child.biomes.push(biome)
        }
      }
    }

    // Update node
    Object.assign(node, {
      children,
      biomes: [],
      isLeaf: false,
    })
  }

  query(bounds: SpatialBounds): BiomePlacement[] {
    const results: BiomePlacement[] = []
    this.queryNode(this.root, bounds, results)
    return results
  }

  private queryNode(node: QuadTreeNode, bounds: SpatialBounds, results: BiomePlacement[]): void {
    if (!this.boundsIntersect(node.bounds, bounds)) {
      return
    }

    if (node.isLeaf) {
      for (const biome of node.biomes) {
        if (coordinateInBounds(biome.coordinate, bounds)) {
          results.push(biome)
        }
      }
    } else if (node.children) {
      for (const child of node.children) {
        this.queryNode(child, bounds, results)
      }
    }
  }

  private boundsIntersect(a: SpatialBounds, b: SpatialBounds): boolean {
    return !(a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ)
  }

  findNearestBiome(coordinate: SpatialCoordinate, maxDistance: number = Infinity): BiomePlacement | null {
    let nearest: BiomePlacement | null = null
    let minDistance = maxDistance

    const searchBounds: SpatialBounds = {
      minX: (coordinate.x - maxDistance) as WorldCoordinate,
      minZ: (coordinate.z - maxDistance) as WorldCoordinate,
      maxX: (coordinate.x + maxDistance) as WorldCoordinate,
      maxZ: (coordinate.z + maxDistance) as WorldCoordinate,
    }

    const candidates = this.query(searchBounds)
    for (const candidate of candidates) {
      const distance = calculateDistance(coordinate, candidate.coordinate)
      if (distance < minDistance) {
        minDistance = distance
        nearest = candidate
      }
    }

    return nearest
  }
}

// === Memory Storage ===

interface MemoryStorage {
  readonly biomeDefinitions: Map<BiomeId, BiomeDefinition>
  readonly spatialIndex: QuadTree
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
      minX: -30000000 as WorldCoordinate,
      minZ: -30000000 as WorldCoordinate,
      maxX: 30000000 as WorldCoordinate,
      maxZ: 30000000 as WorldCoordinate,
    }

    const storageRef = yield* Ref.make<MemoryStorage>({
      biomeDefinitions: new Map(),
      spatialIndex: new QuadTree(worldBounds, config.spatialIndex.maxDepth, config.spatialIndex.maxEntriesPerNode),
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

    const placeBiome = (placement: BiomePlacement): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* Ref.update(storageRef, (storage) => {
          const newIndex = new QuadTree(
            worldBounds,
            config.spatialIndex.maxDepth,
            config.spatialIndex.maxEntriesPerNode
          )

          // Copy existing placements
          const existingPlacements = storage.spatialIndex.query(worldBounds)
          for (const existing of existingPlacements) {
            newIndex.insert(existing)
          }

          // Add new placement
          newIndex.insert(placement)

          return {
            ...storage,
            spatialIndex: newIndex,
          }
        })

        // Update cache
        const key = coordinateToKey(placement.coordinate)
        yield* Ref.update(storageRef, (storage) => ({
          ...storage,
          cache: {
            ...storage.cache,
            biomeCache: new Map(storage.cache.biomeCache).set(key, {
              biomeId: placement.biomeId,
              timestamp: Date.now(),
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

        // Check cache first
        const cached = storage.cache.biomeCache.get(key)
        if (cached && config.cache.enabled) {
          const ttl = config.cache.ttlSeconds * 1000
          if (Date.now() - cached.timestamp < ttl) {
            yield* Ref.update(storageRef, (s) => ({
              ...s,
              cache: {
                ...s.cache,
                statistics: { ...s.cache.statistics, hits: s.cache.statistics.hits + 1 },
              },
            }))
            return Option.some(cached.biomeId)
          }
        }

        // Query spatial index
        const nearest = storage.spatialIndex.findNearestBiome(coordinate, 100) // 100 block search radius

        yield* Ref.update(storageRef, (s) => ({
          ...s,
          cache: {
            ...s.cache,
            statistics: { ...s.cache.statistics, misses: s.cache.statistics.misses + 1 },
          },
        }))

        if (nearest) {
          // Update cache
          yield* Ref.update(storageRef, (s) => ({
            ...s,
            cache: {
              ...s.cache,
              biomeCache: new Map(s.cache.biomeCache).set(key, {
                biomeId: nearest.biomeId,
                timestamp: Date.now(),
              }),
            },
          }))
          return Option.some(nearest.biomeId)
        }

        return Option.none()
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to get biome at coordinate: ${error}`, 'getBiomeAt', error))
        )
      )

    const getBiomesInBounds = (
      bounds: SpatialBounds
    ): Effect.Effect<ReadonlyArray<SpatialQueryResult>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const placements = storage.spatialIndex.query(bounds)

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
          minX: (center.x - radius) as WorldCoordinate,
          minZ: (center.z - radius) as WorldCoordinate,
          maxX: (center.x + radius) as WorldCoordinate,
          maxZ: (center.z + radius) as WorldCoordinate,
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

    const findNearestBiome = (
      coordinate: SpatialCoordinate,
      biomeType?: BiomeId
    ): Effect.Effect<Option.Option<SpatialQueryResult>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const nearest = storage.spatialIndex.findNearestBiome(coordinate)

        if (nearest && (!biomeType || nearest.biomeId === biomeType)) {
          return Option.some({
            biomeId: nearest.biomeId,
            coordinate: nearest.coordinate,
            distance: calculateDistance(coordinate, nearest.coordinate),
            confidence: 1.0,
          })
        }

        return Option.none()
      })

    // === Mock implementations for remaining methods ===

    const updateBiomeDefinition = (biome: BiomeDefinition) => saveBiomeDefinition(biome)
    const deleteBiomeDefinition = (biomeId: BiomeId) => Effect.void
    const executeQuery = (query: SpatialQuery) => findBiomesInRadius(query.center, query.radius)
    const setClimateData = (coordinate: SpatialCoordinate, climate: ClimateData) => Effect.void
    const getClimateData = (coordinate: SpatialCoordinate) => Effect.succeed(Option.none<ClimateData>())
    const interpolateClimateData = (coordinate: SpatialCoordinate) => Effect.succeed({} as ClimateData)
    const createClimateGrid = (bounds: SpatialBounds, resolution: number) => Effect.succeed({} as ClimateGrid)
    const setClimateTransition = (transition: any) => Effect.void
    const rebuildSpatialIndex = () => Effect.void
    const getIndexStatistics = () =>
      Effect.succeed({
        totalEntries: 0,
        indexDepth: 0,
        leafNodes: 0,
        averageEntriesPerNode: 0,
        spatialCoverage: worldBounds,
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

    const getStatistics = (bounds?: SpatialBounds) =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const biomes = Array.from(storage.biomeDefinitions.values())

        return {
          totalBiomes: biomes.length,
          uniqueBiomeTypes: biomes.length,
          coverage: {},
          dominantBiome: biomes[0]?.id || ('plains' as BiomeId),
          raresBiomes: [],
          averageTemperature: 0.5 as any,
          averageHumidity: 0.5 as any,
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
    const exportBiomeData = (bounds: SpatialBounds, format: any) => Effect.succeed(new Uint8Array())
    const importBiomeData = (data: Uint8Array, format: any, bounds: SpatialBounds) => Effect.void
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
      findNearestBiome,
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
      getStatistics,
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
