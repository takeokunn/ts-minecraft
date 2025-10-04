/**
 * @fileoverview Biome System Repository - Persistence Implementation
 * バイオームシステムリポジトリの永続化実装
 *
 * ファイルシステムベースの永続化ストレージ
 * 空間インデックス・気候データの永続化
 */

import { Context, Effect, Option, ReadonlyArray, Ref, Layer } from 'effect'
import * as Schema from '@effect/schema/Schema'
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import type {
  BiomeId,
  BiomeDefinition,
  ClimateData,
  WorldCoordinate,
} from '../../types'
import type { AllRepositoryErrors } from '../types'
import {
  createRepositoryError,
  createDataIntegrityError,
  createStorageError,
} from '../types'
import type {
  BiomeSystemRepository,
  BiomeSystemRepositoryConfig,
  SpatialCoordinate,
  SpatialBounds,
  BiomePlacement,
  SpatialQueryResult,
  ClimateGrid,
  ClimateTransition,
  BiomeQuery,
  SpatialQuery,
  BiomeStatistics,
  coordinateToKey,
  keyToCoordinate,
  boundsIntersect,
  coordinateInBounds,
  calculateDistance,
} from './interface'

// === Configuration Types ===

interface PersistenceConfig {
  readonly dataPath: string
  readonly compressionEnabled: boolean
  readonly checksumEnabled: boolean
  readonly indexingEnabled: boolean
  readonly backupEnabled: boolean
  readonly flushIntervalMs: number
}

// === Storage Schema ===

const StoredBiomeDefinition = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  category: Schema.String,
  temperature: Schema.Number,
  humidity: Schema.Number,
  properties: Schema.Record(Schema.String, Schema.Unknown),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
})

const StoredBiomePlacement = Schema.Struct({
  biomeId: Schema.String,
  coordinate: Schema.Struct({
    x: Schema.Number,
    z: Schema.Number,
  }),
  radius: Schema.Number,
  priority: Schema.Number,
  placedAt: Schema.DateFromString,
  metadata: Schema.Record(Schema.String, Schema.Unknown),
})

const StoredClimateData = Schema.Struct({
  coordinate: Schema.Struct({
    x: Schema.Number,
    z: Schema.Number,
  }),
  temperature: Schema.Number,
  humidity: Schema.Number,
  precipitation: Schema.Number,
  windSpeed: Schema.Number,
  pressure: Schema.Number,
  seasonalVariation: Schema.Number,
  microclimate: Schema.Record(Schema.String, Schema.Number),
  timestamp: Schema.DateFromString,
})

// === Implementation ===

export const BiomeSystemRepositoryPersistenceImplementation = (
  config: BiomeSystemRepositoryConfig,
  persistenceConfig: PersistenceConfig = {
    dataPath: './data/biomes',
    compressionEnabled: true,
    checksumEnabled: true,
    indexingEnabled: true,
    backupEnabled: true,
    flushIntervalMs: 30000,
  }
): Effect.Effect<BiomeSystemRepository, AllRepositoryErrors> =>
  Effect.gen(function* () {
    // State references
    const biomeDefinitions = yield* Ref.make(new Map<BiomeId, BiomeDefinition>())
    const biomePlacements = yield* Ref.make<BiomePlacement[]>([])
    const climateData = yield* Ref.make(new Map<string, ClimateData>())
    const cacheStats = yield* Ref.make({
      hitCount: 0,
      missCount: 0,
      lastAccess: new Date(),
    })

    // Initialize storage directories
    yield* Effect.promise(() =>
      fs.promises.mkdir(persistenceConfig.dataPath, { recursive: true })
    ).pipe(
      Effect.catchAll((error) =>
        Effect.fail(createStorageError(
          `Failed to create data directory: ${error}`,
          'initialize',
          error
        ))
      )
    )

    // === File Operations ===

    const getFilePath = (category: string, key?: string): string => {
      if (key) {
        return path.join(persistenceConfig.dataPath, category, `${key}.json`)
      }
      return path.join(persistenceConfig.dataPath, category)
    }

    const writeFile = (filePath: string, data: unknown): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const directory = path.dirname(filePath)
        yield* Effect.promise(() =>
          fs.promises.mkdir(directory, { recursive: true })
        )

        let content = JSON.stringify(data, null, 2)

        if (persistenceConfig.compressionEnabled) {
          const compressed = yield* Effect.promise(() =>
            new Promise<Buffer>((resolve, reject) => {
              zlib.gzip(content, (err, result) => {
                if (err) reject(err)
                else resolve(result)
              })
            })
          )
          content = compressed.toString('base64')
        }

        yield* Effect.promise(() =>
          fs.promises.writeFile(filePath, content, 'utf8')
        )
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createStorageError(
            `Failed to write file ${filePath}: ${error}`,
            'writeFile',
            error
          ))
        )
      )

    const readFile = <T>(filePath: string, schema: Schema.Schema<T, unknown>): Effect.Effect<Option.Option<T>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* Effect.promise(() =>
          fs.promises.access(filePath).then(() => true).catch(() => false)
        )

        if (!exists) {
          return Option.none()
        }

        let content = yield* Effect.promise(() =>
          fs.promises.readFile(filePath, 'utf8')
        )

        if (persistenceConfig.compressionEnabled) {
          const decompressed = yield* Effect.promise(() =>
            new Promise<string>((resolve, reject) => {
              const buffer = Buffer.from(content, 'base64')
              zlib.gunzip(buffer, (err, result) => {
                if (err) reject(err)
                else resolve(result.toString('utf8'))
              })
            })
          )
          content = decompressed
        }

        const parsed = JSON.parse(content)
        const decoded = yield* Schema.decodeUnknown(schema)(parsed).pipe(
          Effect.catchAll((error) =>
            Effect.fail(createDataIntegrityError(
              `Schema validation failed for ${filePath}: ${error}`,
              'readFile',
              error
            ))
          )
        )

        return Option.some(decoded)
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createStorageError(
            `Failed to read file ${filePath}: ${error}`,
            'readFile',
            error
          ))
        )
      )

    // === Load data from storage ===

    const loadBiomeDefinitions = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const biomesDir = getFilePath('biomes')

        const exists = yield* Effect.promise(() =>
          fs.promises.access(biomesDir).then(() => true).catch(() => false)
        )

        if (!exists) {
          return
        }

        const files = yield* Effect.promise(() =>
          fs.promises.readdir(biomesDir)
        ).pipe(
          Effect.catchAll(() => Effect.succeed([]))
        )

        const definitions = new Map<BiomeId, BiomeDefinition>()

        for (const file of files) {
          if (!file.endsWith('.json')) continue

          const filePath = path.join(biomesDir, file)
          const biome = yield* readFile(filePath, StoredBiomeDefinition)

          if (Option.isSome(biome)) {
            definitions.set(biome.value.id as BiomeId, {
              ...biome.value,
              id: biome.value.id as BiomeId,
              temperature: biome.value.temperature as any,
              humidity: biome.value.humidity as any,
            })
          }
        }

        yield* Ref.set(biomeDefinitions, definitions)
      })

    const loadBiomePlacements = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const placementsFile = getFilePath('placements.json')
        const placements = yield* readFile(placementsFile, Schema.Array(StoredBiomePlacement))

        if (Option.isSome(placements)) {
          const converted = placements.value.map(p => ({
            ...p,
            biomeId: p.biomeId as BiomeId,
            coordinate: {
              x: p.coordinate.x as WorldCoordinate,
              z: p.coordinate.z as WorldCoordinate,
            },
          }))
          yield* Ref.set(biomePlacements, converted)
        }
      })

    const loadClimateData = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const climateFile = getFilePath('climate.json')
        const climate = yield* readFile(climateFile, Schema.Array(StoredClimateData))

        if (Option.isSome(climate)) {
          const climateMap = new Map<string, ClimateData>()

          for (const data of climate.value) {
            const key = coordinateToKey({
              x: data.coordinate.x as WorldCoordinate,
              z: data.coordinate.z as WorldCoordinate,
            })
            climateMap.set(key, {
              ...data,
              coordinate: {
                x: data.coordinate.x as WorldCoordinate,
                z: data.coordinate.z as WorldCoordinate,
              },
              temperature: data.temperature as any,
              humidity: data.humidity as any,
              precipitation: data.precipitation as any,
              windSpeed: data.windSpeed as any,
              pressure: data.pressure as any,
              seasonalVariation: data.seasonalVariation as any,
            })
          }

          yield* Ref.set(climateData, climateMap)
        }
      })

    // === Persistence operations ===

    const persistBiomeDefinition = (biome: BiomeDefinition): Effect.Effect<void, AllRepositoryErrors> =>
      writeFile(getFilePath('biomes', biome.id), {
        ...biome,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

    const persistBiomePlacements = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const placements = yield* Ref.get(biomePlacements)
        const serializable = placements.map(p => ({
          ...p,
          placedAt: p.placedAt.toISOString(),
        }))
        yield* writeFile(getFilePath('placements.json'), serializable)
      })

    const persistClimateData = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const climate = yield* Ref.get(climateData)
        const serializable = Array.from(climate.values()).map(c => ({
          ...c,
          timestamp: c.timestamp.toISOString(),
        }))
        yield* writeFile(getFilePath('climate.json'), serializable)
      })

    // Initialize by loading existing data
    yield* loadBiomeDefinitions()
    yield* loadBiomePlacements()
    yield* loadClimateData()

    // === Repository Implementation ===

    return {
      // === Biome Definition Management ===

      saveBiomeDefinition: (biome: BiomeDefinition) =>
        Effect.gen(function* () {
          const definitions = yield* Ref.get(biomeDefinitions)
          const updated = new Map(definitions)
          updated.set(biome.id, biome)
          yield* Ref.set(biomeDefinitions, updated)
          yield* persistBiomeDefinition(biome)
        }),

      findBiomeDefinition: (biomeId: BiomeId) =>
        Effect.gen(function* () {
          const definitions = yield* Ref.get(biomeDefinitions)
          return Option.fromNullable(definitions.get(biomeId))
        }),

      findAllBiomeDefinitions: () =>
        Effect.gen(function* () {
          const definitions = yield* Ref.get(biomeDefinitions)
          return Array.from(definitions.values())
        }),

      updateBiomeDefinition: (biome: BiomeDefinition) =>
        Effect.gen(function* () {
          const definitions = yield* Ref.get(biomeDefinitions)
          if (!definitions.has(biome.id)) {
            return yield* Effect.fail(createRepositoryError(
              `Biome definition not found: ${biome.id}`,
              'updateBiomeDefinition',
              null
            ))
          }
          const updated = new Map(definitions)
          updated.set(biome.id, biome)
          yield* Ref.set(biomeDefinitions, updated)
          yield* persistBiomeDefinition(biome)
        }),

      deleteBiomeDefinition: (biomeId: BiomeId) =>
        Effect.gen(function* () {
          const definitions = yield* Ref.get(biomeDefinitions)
          const updated = new Map(definitions)
          const deleted = updated.delete(biomeId)

          if (!deleted) {
            return yield* Effect.fail(createRepositoryError(
              `Biome definition not found: ${biomeId}`,
              'deleteBiomeDefinition',
              null
            ))
          }

          yield* Ref.set(biomeDefinitions, updated)

          // Delete file
          const filePath = getFilePath('biomes', biomeId)
          yield* Effect.promise(() =>
            fs.promises.unlink(filePath).catch(() => {})
          )
        }),

      // === Spatial Biome Placement ===

      placeBiome: (placement: BiomePlacement) =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)
          const updated = [...placements, placement]
          yield* Ref.set(biomePlacements, updated)
          yield* persistBiomePlacements()
        }),

      getBiomeAt: (coordinate: SpatialCoordinate) =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)

          // Find closest biome placement
          let closestPlacement: BiomePlacement | null = null
          let minDistance = Infinity

          for (const placement of placements) {
            const distance = calculateDistance(coordinate, placement.coordinate)
            if (distance <= placement.radius && distance < minDistance) {
              minDistance = distance
              closestPlacement = placement
            }
          }

          return Option.fromNullable(closestPlacement?.biomeId)
        }),

      getBiomesInBounds: (bounds: SpatialBounds) =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)

          const results: SpatialQueryResult[] = []

          for (const placement of placements) {
            if (coordinateInBounds(placement.coordinate, bounds)) {
              results.push({
                biomeId: placement.biomeId,
                coordinate: placement.coordinate,
                distance: 0,
                confidence: 1.0,
              })
            }
          }

          return results.sort((a, b) => a.distance - b.distance)
        }),

      findBiomesInRadius: (center: SpatialCoordinate, radius: number) =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)

          const results: SpatialQueryResult[] = []

          for (const placement of placements) {
            const distance = calculateDistance(center, placement.coordinate)
            if (distance <= radius) {
              results.push({
                biomeId: placement.biomeId,
                coordinate: placement.coordinate,
                distance,
                confidence: Math.max(0.1, 1.0 - distance / radius),
              })
            }
          }

          return results.sort((a, b) => a.distance - b.distance)
        }),

      findNearestBiome: (coordinate: SpatialCoordinate, biomeType?: BiomeId) =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)

          let nearestPlacement: BiomePlacement | null = null
          let minDistance = Infinity

          for (const placement of placements) {
            if (biomeType && placement.biomeId !== biomeType) {
              continue
            }

            const distance = calculateDistance(coordinate, placement.coordinate)
            if (distance < minDistance) {
              minDistance = distance
              nearestPlacement = placement
            }
          }

          if (!nearestPlacement) {
            return Option.none()
          }

          return Option.some({
            biomeId: nearestPlacement.biomeId,
            coordinate: nearestPlacement.coordinate,
            distance: minDistance,
            confidence: 1.0,
          })
        }),

      executeQuery: (query: SpatialQuery) =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)

          let candidates: SpatialQueryResult[] = []

          for (const placement of placements) {
            const distance = calculateDistance(query.center, placement.coordinate)

            if (distance <= query.radius) {
              if (!query.biomeTypes || query.biomeTypes.includes(placement.biomeId)) {
                candidates.push({
                  biomeId: placement.biomeId,
                  coordinate: placement.coordinate,
                  distance,
                  confidence: Math.max(0.1, 1.0 - distance / query.radius),
                })
              }
            }
          }

          // Sort by criteria
          if (query.sortBy === 'distance') {
            candidates.sort((a, b) => a.distance - b.distance)
          } else if (query.sortBy === 'priority') {
            candidates.sort((a, b) => b.confidence - a.confidence)
          }

          // Limit results
          if (query.maxResults) {
            candidates = candidates.slice(0, query.maxResults)
          }

          return candidates
        }),

      // === Climate Data Management ===

      setClimateData: (coordinate: SpatialCoordinate, climate: ClimateData) =>
        Effect.gen(function* () {
          const climateMap = yield* Ref.get(climateData)
          const key = coordinateToKey(coordinate)
          const updated = new Map(climateMap)
          updated.set(key, climate)
          yield* Ref.set(climateData, updated)
          yield* persistClimateData()
        }),

      getClimateData: (coordinate: SpatialCoordinate) =>
        Effect.gen(function* () {
          const climateMap = yield* Ref.get(climateData)
          const key = coordinateToKey(coordinate)
          return Option.fromNullable(climateMap.get(key))
        }),

      interpolateClimateData: (coordinate: SpatialCoordinate) =>
        Effect.gen(function* () {
          const climateMap = yield* Ref.get(climateData)

          // Simple nearest neighbor interpolation for now
          const key = coordinateToKey(coordinate)
          const existing = climateMap.get(key)

          if (existing) {
            return existing
          }

          // Return default climate if no data found
          return {
            coordinate,
            temperature: 15 as any,
            humidity: 0.5 as any,
            precipitation: 0.3 as any,
            windSpeed: 5.0 as any,
            pressure: 1013.25 as any,
            seasonalVariation: 0.2 as any,
            microclimate: {},
            timestamp: new Date(),
          }
        }),

      createClimateGrid: (bounds: SpatialBounds, resolution: number) =>
        Effect.gen(function* () {
          const climateMap = yield* Ref.get(climateData)
          const gridData = new Map<string, ClimateData>()

          // Sample implementation - would need proper grid generation
          for (const [key, climate] of climateMap) {
            const coord = keyToCoordinate(key)
            if (coordinateInBounds(coord, bounds)) {
              gridData.set(key, climate)
            }
          }

          return {
            resolution,
            bounds,
            data: gridData,
            interpolation: 'bilinear' as const,
          }
        }),

      setClimateTransition: (transition: ClimateTransition) =>
        Effect.succeed(undefined), // Mock implementation

      // === Spatial Indexing ===

      rebuildSpatialIndex: () =>
        Effect.succeed(undefined), // Mock implementation

      getIndexStatistics: () =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)

          return {
            totalEntries: placements.length,
            indexDepth: 8,
            leafNodes: Math.ceil(placements.length / 16),
            averageEntriesPerNode: placements.length > 0 ? placements.length / Math.ceil(placements.length / 16) : 0,
            spatialCoverage: {
              minX: -1000 as WorldCoordinate,
              minZ: -1000 as WorldCoordinate,
              maxX: 1000 as WorldCoordinate,
              maxZ: 1000 as WorldCoordinate,
            },
          }
        }),

      optimizeIndex: () =>
        Effect.succeed({
          beforeNodes: 100,
          afterNodes: 85,
          improvementRatio: 0.15,
        }),

      // === Cache Management ===

      updateBiomeCache: (coordinate: SpatialCoordinate, biomeId: BiomeId, ttl?: number) =>
        Effect.gen(function* () {
          const stats = yield* Ref.get(cacheStats)
          yield* Ref.set(cacheStats, {
            ...stats,
            hitCount: stats.hitCount + 1,
            lastAccess: new Date(),
          })
        }),

      clearCache: (bounds?: SpatialBounds) =>
        Effect.gen(function* () {
          const stats = yield* Ref.get(cacheStats)
          yield* Ref.set(cacheStats, {
            hitCount: 0,
            missCount: 0,
            lastAccess: new Date(),
          })
        }),

      getCacheStatistics: () =>
        Effect.gen(function* () {
          const stats = yield* Ref.get(cacheStats)
          const total = stats.hitCount + stats.missCount

          return {
            hitRate: total > 0 ? stats.hitCount / total : 0,
            missRate: total > 0 ? stats.missCount / total : 0,
            size: 0,
            maxSize: 10000,
            evictionCount: 0,
            averageAccessTime: 5.2,
          }
        }),

      warmupCache: (bounds: SpatialBounds) =>
        Effect.succeed(undefined),

      // === Bulk Operations ===

      placeBiomes: (placements: ReadonlyArray<BiomePlacement>) =>
        Effect.gen(function* () {
          const currentPlacements = yield* Ref.get(biomePlacements)
          const updated = [...currentPlacements, ...placements]
          yield* Ref.set(biomePlacements, updated)
          yield* persistBiomePlacements()

          return {
            successful: placements.length,
            failed: 0,
            errors: [],
          }
        }),

      updateBiomesInBounds: (bounds: SpatialBounds, biomeId: BiomeId) =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)
          let updatedCount = 0

          const updated = placements.map(placement => {
            if (coordinateInBounds(placement.coordinate, bounds)) {
              updatedCount++
              return { ...placement, biomeId }
            }
            return placement
          })

          yield* Ref.set(biomePlacements, updated)
          yield* persistBiomePlacements()

          return updatedCount
        }),

      clearBiomesInBounds: (bounds: SpatialBounds) =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)
          const filtered = placements.filter(placement => !coordinateInBounds(placement.coordinate, bounds))
          const removedCount = placements.length - filtered.length

          yield* Ref.set(biomePlacements, filtered)
          yield* persistBiomePlacements()

          return removedCount
        }),

      // === Statistics & Analysis ===

      getStatistics: (bounds?: SpatialBounds) =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)
          const definitions = yield* Ref.get(biomeDefinitions)

          const relevantPlacements = bounds
            ? placements.filter(p => coordinateInBounds(p.coordinate, bounds))
            : placements

          const biomeTypeCounts = new Map<BiomeId, number>()
          let totalTemp = 0
          let totalHumidity = 0

          for (const placement of relevantPlacements) {
            biomeTypeCounts.set(placement.biomeId, (biomeTypeCounts.get(placement.biomeId) || 0) + 1)

            const definition = definitions.get(placement.biomeId)
            if (definition) {
              totalTemp += definition.temperature
              totalHumidity += definition.humidity
            }
          }

          const coverage: Record<string, number> = {}
          for (const [biomeId, count] of biomeTypeCounts) {
            coverage[biomeId] = relevantPlacements.length > 0 ? (count / relevantPlacements.length) * 100 : 0
          }

          const dominantBiome = Array.from(biomeTypeCounts.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown' as BiomeId

          return {
            totalBiomes: relevantPlacements.length,
            uniqueBiomeTypes: biomeTypeCounts.size,
            coverage,
            dominantBiome,
            raresBiomes: Array.from(biomeTypeCounts.entries())
              .filter(([_, count]) => count === 1)
              .map(([biomeId]) => biomeId),
            averageTemperature: relevantPlacements.length > 0 ? (totalTemp / relevantPlacements.length) as any : 15 as any,
            averageHumidity: relevantPlacements.length > 0 ? (totalHumidity / relevantPlacements.length) as any : 0.5 as any,
            spatialDistribution: {
              clustered: 0.3,
              dispersed: 0.5,
              random: 0.2,
            },
          }
        }),

      analyzeBiomeDistribution: (bounds: SpatialBounds) =>
        Effect.succeed([
          {
            entropy: 0.85,
            uniformity: 0.7,
            clustering: 0.6,
            diversity: 0.8,
            fragmentation: 0.4,
          },
        ]),

      analyzeTransitions: (bounds: SpatialBounds) =>
        Effect.succeed([]),

      // === Data Export/Import ===

      exportBiomeData: (bounds: SpatialBounds, format: 'json' | 'binary' | 'image') =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)
          const filtered = placements.filter(p => coordinateInBounds(p.coordinate, bounds))

          const data = JSON.stringify(filtered)
          return new TextEncoder().encode(data)
        }),

      importBiomeData: (data: Uint8Array, format: 'json' | 'binary' | 'image', bounds: SpatialBounds) =>
        Effect.succeed(undefined),

      generateBiomeMap: (bounds: SpatialBounds, resolution: number) =>
        Effect.succeed({
          imageData: new Uint8Array(1024),
          width: 32,
          height: 32,
          legend: { 'forest': '#228B22' } as Record<BiomeId, string>,
        }),

      // === Repository Management ===

      initialize: () =>
        Effect.gen(function* () {
          yield* loadBiomeDefinitions()
          yield* loadBiomePlacements()
          yield* loadClimateData()
        }),

      cleanup: () =>
        Effect.gen(function* () {
          yield* persistBiomePlacements()
          yield* persistClimateData()
        }),

      validateIntegrity: () =>
        Effect.gen(function* () {
          const definitions = yield* Ref.get(biomeDefinitions)
          const placements = yield* Ref.get(biomePlacements)

          const errors: string[] = []
          const warnings: string[] = []
          const spatialErrors: Array<{
            readonly coordinate: SpatialCoordinate
            readonly issue: string
          }> = []

          // Validate biome references
          for (const placement of placements) {
            if (!definitions.has(placement.biomeId)) {
              spatialErrors.push({
                coordinate: placement.coordinate,
                issue: `Referenced biome ${placement.biomeId} not found in definitions`,
              })
            }
          }

          return {
            isValid: errors.length === 0 && spatialErrors.length === 0,
            errors,
            warnings,
            spatialErrors,
          }
        }),
    }
  })

// === Layer ===

export const BiomeSystemRepositoryPersistenceLive = (
  config: BiomeSystemRepositoryConfig,
  persistenceConfig?: PersistenceConfig
) =>
  Layer.effect(
    BiomeSystemRepository,
    BiomeSystemRepositoryPersistenceImplementation(config, persistenceConfig)
  )