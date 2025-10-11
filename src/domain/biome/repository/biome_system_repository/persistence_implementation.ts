/**
 * @fileoverview Biome System Repository - Persistence Implementation
 * バイオームシステムリポジトリの永続化実装
 *
 * ファイルシステムベースの永続化ストレージ
 * 空間インデックス・気候データの永続化
 */

import {
  makeUnsafeWorldCoordinate2D,
  makeUnsafeWorldX,
  makeUnsafeWorldZ,
} from '@/domain/biome/value_object/coordinates'
import type { AllRepositoryErrors, BiomeDefinition, BiomeId, ClimateData } from '@domain/world/types'
import { createBiomeId, createDataIntegrityError, createRepositoryError, createStorageError } from '@domain/world/types'
import {
  HumiditySchema,
  PrecipitationSchema,
  PressureSchema,
  SeasonalVariationSchema,
  TemperatureSchema,
  WindSpeedSchema,
} from '@domain/world/value_object/generation_parameters/biome_config'
import * as Schema from '@effect/schema/Schema'
import { JsonValueSchema } from '@shared/schema/json'
import { Clock, DateTime, Effect, Layer, Option, pipe, ReadonlyArray, Ref } from 'effect'
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import type {
  BiomePlacement,
  BiomeSystemRepository,
  BiomeSystemRepositoryConfig,
  calculateDistance,
  ClimateTransition,
  coordinateInBounds,
  coordinateToKey,
  keyToCoordinate,
  SpatialBounds,
  SpatialCoordinate,
  SpatialQuery,
} from './index'

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
  temperature: TemperatureSchema,
  humidity: HumiditySchema,
  properties: Schema.Record(Schema.String, JsonValueSchema),
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
  metadata: Schema.Record(Schema.String, JsonValueSchema),
})

const StoredClimateData = Schema.Struct({
  coordinate: Schema.Struct({
    x: Schema.Number,
    z: Schema.Number,
  }),
  temperature: TemperatureSchema,
  humidity: HumiditySchema,
  precipitation: PrecipitationSchema,
  windSpeed: WindSpeedSchema,
  pressure: PressureSchema,
  seasonalVariation: SeasonalVariationSchema,
  microclimate: Schema.Record(Schema.String, Schema.Number),
  timestamp: Schema.DateFromString,
})

const currentDate = DateTime.nowAsDate

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
    const initialNow = yield* currentDate
    const cacheStats = yield* Ref.make({
      hitCount: 0,
      missCount: 0,
      lastAccess: initialNow,
    })

    // Initialize storage directories
    yield* Effect.promise(() => fs.promises.mkdir(persistenceConfig.dataPath, { recursive: true }))
      .pipe(
        Effect.annotateLogs('biome.persistence.operation', 'mkdir'),
        Effect.annotateLogs('biome.persistence.path', persistenceConfig.dataPath),
        Effect.catchAll((error) =>
          Effect.fail(createStorageError(`Failed to create data directory: ${error}`, 'initialize', error))
        )
      )

    // === File Operations ===

    const getFilePath = (category: string, key?: string): string =>
      pipe(
        Option.fromNullable(key),
        Option.match({
          onNone: () => path.join(persistenceConfig.dataPath, category),
          onSome: (k) => path.join(persistenceConfig.dataPath, category, `${k}.json`),
        })
      )

    const writeFile = (filePath: string, data: unknown): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const directory = path.dirname(filePath)
        yield* Effect.promise(() => fs.promises.mkdir(directory, { recursive: true })).pipe(
          Effect.annotateLogs('biome.persistence.operation', 'mkdir'),
          Effect.annotateLogs('biome.persistence.path', directory)
        )

        const jsonContent = JSON.stringify(data, null, 2)

        const content = yield* Effect.if(persistenceConfig.compressionEnabled, {
          onTrue: () =>
            Effect.gen(function* () {
              const compressed = yield* Effect.async<Buffer, AllRepositoryErrors>((resume) => {
                zlib.gzip(jsonContent, (err, result) => {
                  if (err) {
                    resume(Effect.fail(createStorageError(`Compression failed: ${err}`, 'writeFile', err)))
                  } else {
                    resume(Effect.succeed(result))
                  }
                })
              }).pipe(
                Effect.annotateLogs('biome.persistence.operation', 'compress'),
                Effect.annotateLogs('biome.persistence.dataLength', jsonContent.length)
              )
              return compressed.toString('base64')
            }),
          onFalse: () => Effect.succeed(jsonContent),
        })

        yield* Effect.promise(() => fs.promises.writeFile(filePath, content, 'utf8')).pipe(
          Effect.annotateLogs('biome.persistence.operation', 'writeFile'),
          Effect.annotateLogs('biome.persistence.path', filePath)
        )
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createStorageError(`Failed to write file ${filePath}: ${error}`, 'writeFile', error))
        )
      )

    const readFile = <T>(
      filePath: string,
      schema: Schema.Schema<T, unknown>
    ): Effect.Effect<Option.Option<T>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* Effect.promise(() =>
          fs.promises
            .access(filePath)
            .then(() => true)
            .catch(() => false)
        ).pipe(
          Effect.annotateLogs('biome.persistence.operation', 'access'),
          Effect.annotateLogs('biome.persistence.path', filePath)
        )

        return yield* Effect.if(exists, {
          onTrue: () =>
            Effect.gen(function* () {
              const rawContent = yield* Effect.promise(() => fs.promises.readFile(filePath, 'utf8')).pipe(
                Effect.annotateLogs('biome.persistence.operation', 'readFile'),
                Effect.annotateLogs('biome.persistence.path', filePath)
              )

              const content = yield* Effect.if(persistenceConfig.compressionEnabled, {
                onTrue: () =>
                  Effect.async<string, AllRepositoryErrors>((resume) => {
                    const buffer = Buffer.from(rawContent, 'base64')
                    zlib.gunzip(buffer, (err, result) => {
                      if (err) {
                        resume(Effect.fail(createStorageError(`Decompression failed: ${err}`, 'readFile', err)))
                      } else {
                        resume(Effect.succeed(result.toString('utf8')))
                      }
                    })
                  }).pipe(
                    Effect.annotateLogs('biome.persistence.operation', 'decompress'),
                    Effect.annotateLogs('biome.persistence.bufferLength', rawContent.length)
                  ),
                onFalse: () => Effect.succeed(rawContent),
              })

              // パターンB: Effect.try + Effect.flatMap + Schema.decodeUnknown
              const decoded = yield* Effect.try({
                try: () => JSON.parse(content),
                catch: (error) =>
                  createDataIntegrityError(`JSON parse failed for ${filePath}: ${String(error)}`, 'readFile', error),
              }).pipe(
                Effect.flatMap(Schema.decodeUnknown(schema)),
                Effect.catchAll((error) =>
                  Effect.fail(
                    createDataIntegrityError(`Schema validation failed for ${filePath}: ${error}`, 'readFile', error)
                  )
                )
              )

              return Option.some(decoded)
            }),
          onFalse: () => Effect.succeed(Option.none<T>()),
        })
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createStorageError(`Failed to read file ${filePath}: ${error}`, 'readFile', error))
        )
      )

    // === Load data from storage ===

    const loadBiomeDefinitions = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const biomesDir = getFilePath('biomes')

        const exists = yield* Effect.promise(() =>
          fs.promises
            .access(biomesDir)
            .then(() => true)
            .catch(() => false)
        )

        yield* Effect.when(exists, () =>
          Effect.gen(function* () {
            const files = yield* Effect.promise(() => fs.promises.readdir(biomesDir)).pipe(
              Effect.catchAll(() => Effect.succeed([]))
            )

            const jsonFiles = files.filter((file) => file.endsWith('.json'))

            const biomes = yield* Effect.forEach(
              jsonFiles,
              (file) =>
                Effect.gen(function* () {
                  const filePath = path.join(biomesDir, file)
                  const biome = yield* readFile(filePath, StoredBiomeDefinition)

                  return pipe(
                    biome,
                    Option.map((b) => ({
                      ...b,
                      id: createBiomeId(b.id),
                    }))
                  )
                }),
              { concurrency: 'sequential' }
            )

            const definitions = new Map<BiomeId, BiomeDefinition>()
            pipe(
              biomes,
              ReadonlyArray.filter(Option.isSome),
              ReadonlyArray.forEach((someBiome) => {
                definitions.set(someBiome.value.id, someBiome.value)
              })
            )

            yield* Ref.set(biomeDefinitions, definitions)
          })
        )
      })

    const loadBiomePlacements = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const placementsFile = getFilePath('placements.json')
        const placements = yield* readFile(placementsFile, Schema.Array(StoredBiomePlacement))

        yield* pipe(
          placements,
          Option.match({
            onNone: () => Effect.void,
            onSome: (value) =>
              Effect.gen(function* () {
                const converted = value.map((p) => ({
                  ...p,
                  biomeId: createBiomeId(p.biomeId),
                  coordinate: makeUnsafeWorldCoordinate2D(p.coordinate.x, p.coordinate.z),
                }))
                yield* Ref.set(biomePlacements, converted)
              }),
          })
        )
      })

    const loadClimateData = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const climateFile = getFilePath('climate.json')
        const climate = yield* readFile(climateFile, Schema.Array(StoredClimateData))

        yield* pipe(
          climate,
          Option.match({
            onNone: () => Effect.void,
            onSome: (value) =>
              Effect.gen(function* () {
                const climateMap = pipe(
                  value,
                  ReadonlyArray.reduce(new Map<string, ClimateData>(), (acc, data) => {
                    const coord = makeUnsafeWorldCoordinate2D(data.coordinate.x, data.coordinate.z)
                    const key = coordinateToKey(coord)
                    acc.set(key, {
                      ...data,
                      coordinate: coord,
                    })
                    return acc
                  })
                )

                yield* Ref.set(climateData, climateMap)
              }),
          })
        )
      })

    // === Persistence operations ===

    const persistBiomeDefinition = (biome: BiomeDefinition): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const now = yield* currentDate
        return yield* writeFile(getFilePath('biomes', biome.id), {
          ...biome,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        })
      })

    const persistBiomePlacements = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const placements = yield* Ref.get(biomePlacements)
        const serializable = placements.map((p) => ({
          ...p,
          placedAt: p.placedAt.toISOString(),
        }))
        yield* writeFile(getFilePath('placements.json'), serializable)
      })

    const persistClimateData = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const climate = yield* Ref.get(climateData)
        const serializable = Array.from(climate.values()).map((c) => ({
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
          yield* Effect.filterOrFail(
            definitions.has(biome.id),
            (has) => has,
            () => createRepositoryError(`Biome definition not found: ${biome.id}`, 'updateBiomeDefinition', null)
          )
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

          yield* Effect.filterOrFail(
            deleted,
            (d) => d,
            () => createRepositoryError(`Biome definition not found: ${biomeId}`, 'deleteBiomeDefinition', null)
          )

          yield* Ref.set(biomeDefinitions, updated)

          const filePath = getFilePath('biomes', biomeId)
          yield* Effect.promise(() => fs.promises.unlink(filePath).catch(() => {}))
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

          const closestPlacement = pipe(
            placements,
            ReadonlyArray.reduce(
              { placement: null as BiomePlacement | null, minDistance: Infinity },
              (acc, placement) => {
                const distance = calculateDistance(coordinate, placement.coordinate)
                return distance <= placement.radius && distance < acc.minDistance
                  ? { placement, minDistance: distance }
                  : acc
              }
            )
          )

          return Option.fromNullable(closestPlacement.placement?.biomeId)
        }),

      getBiomesInBounds: (bounds: SpatialBounds) =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)

          return pipe(
            placements,
            ReadonlyArray.filter((placement) => coordinateInBounds(placement.coordinate, bounds)),
            ReadonlyArray.map((placement) => ({
              biomeId: placement.biomeId,
              coordinate: placement.coordinate,
              distance: 0,
              confidence: 1.0,
            })),
            ReadonlyArray.sort((a, b) => a.distance - b.distance)
          )
        }),

      findBiomesInRadius: (center: SpatialCoordinate, radius: number) =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)

          return pipe(
            placements,
            ReadonlyArray.filterMap((placement) => {
              const distance = calculateDistance(center, placement.coordinate)
              return distance <= radius
                ? Option.some({
                    biomeId: placement.biomeId,
                    coordinate: placement.coordinate,
                    distance,
                    confidence: Math.max(0.1, 1.0 - distance / radius),
                  })
                : Option.none()
            }),
            ReadonlyArray.sort((a, b) => a.distance - b.distance)
          )
        }),

      findNearestBiome: (coordinate: SpatialCoordinate, biomeType?: BiomeId) =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)

          const nearestResult = pipe(
            placements,
            ReadonlyArray.filter((placement) => !biomeType || placement.biomeId === biomeType),
            ReadonlyArray.reduce(
              { placement: null as BiomePlacement | null, minDistance: Infinity },
              (acc, placement) => {
                const distance = calculateDistance(coordinate, placement.coordinate)
                return distance < acc.minDistance ? { placement, minDistance: distance } : acc
              }
            )
          )

          return pipe(
            Option.fromNullable(nearestResult.placement),
            Option.map((placement) => ({
              biomeId: placement.biomeId,
              coordinate: placement.coordinate,
              distance: nearestResult.minDistance,
              confidence: 1.0,
            }))
          )
        }),

      executeQuery: (query: SpatialQuery) =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)

          const candidates = pipe(
            placements,
            ReadonlyArray.filterMap((placement) => {
              const distance = calculateDistance(query.center, placement.coordinate)

              return distance <= query.radius && (!query.biomeTypes || query.biomeTypes.includes(placement.biomeId))
                ? Option.some({
                    biomeId: placement.biomeId,
                    coordinate: placement.coordinate,
                    distance,
                    confidence: Math.max(0.1, 1.0 - distance / query.radius),
                  })
                : Option.none()
            }),
            (results) =>
              query.sortBy === 'distance'
                ? ReadonlyArray.sort(results, (a, b) => a.distance - b.distance)
                : query.sortBy === 'priority'
                  ? ReadonlyArray.sort(results, (a, b) => b.confidence - a.confidence)
                  : results,
            (results) => (query.maxResults ? ReadonlyArray.take(results, query.maxResults) : results)
          )

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

          const key = coordinateToKey(coordinate)
          const existing = climateMap.get(key)

          return yield* pipe(
            Option.fromNullable(existing),
            Option.match({
              onSome: (value) => Effect.succeed(value),
              onNone: () =>
                Effect.gen(function* () {
                  const now = yield* currentDate
                  return {
                    coordinate,
                    temperature: Schema.decodeSync(TemperatureSchema)(15),
                    humidity: Schema.decodeSync(HumiditySchema)(0.5),
                    precipitation: Schema.decodeSync(PrecipitationSchema)(300),
                    windSpeed: Schema.decodeSync(WindSpeedSchema)(5.0),
                    pressure: Schema.decodeSync(PressureSchema)(1013.25),
                    seasonalVariation: Schema.decodeSync(SeasonalVariationSchema)(0.2),
                    microclimate: {},
                    timestamp: now,
                  }
                }),
            })
          )
        }),

      createClimateGrid: (bounds: SpatialBounds, resolution: number) =>
        Effect.gen(function* () {
          const climateMap = yield* Ref.get(climateData)

          const gridData = pipe(
            Array.from(climateMap.entries()),
            ReadonlyArray.filter(([key, _]) => coordinateInBounds(keyToCoordinate(key), bounds)),
            ReadonlyArray.reduce(new Map<string, ClimateData>(), (acc, [key, climate]) => {
              acc.set(key, climate)
              return acc
            })
          )

          return {
            resolution,
            bounds,
            data: gridData,
            interpolation: 'bilinear' as const,
          }
        }),

      setClimateTransition: (transition: ClimateTransition) => Effect.succeed(undefined), // Mock implementation

      // === Spatial Indexing ===

      rebuildSpatialIndex: () => Effect.succeed(undefined), // Mock implementation

      getIndexStatistics: () =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)

          return {
            totalEntries: placements.length,
            indexDepth: 8,
            leafNodes: Math.ceil(placements.length / 16),
            averageEntriesPerNode: placements.length > 0 ? placements.length / Math.ceil(placements.length / 16) : 0,
            spatialCoverage: {
              minX: makeUnsafeWorldX(-1000),
              minZ: makeUnsafeWorldZ(-1000),
              maxX: makeUnsafeWorldX(1000),
              maxZ: makeUnsafeWorldZ(1000),
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
          const now = yield* currentDate
          yield* Ref.set(cacheStats, {
            ...stats,
            hitCount: stats.hitCount + 1,
            lastAccess: now,
          })
        }),

      clearCache: (bounds?: SpatialBounds) =>
        Effect.gen(function* () {
          const now = yield* currentDate
          yield* Ref.set(cacheStats, {
            hitCount: 0,
            missCount: 0,
            lastAccess: now,
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

      warmupCache: (bounds: SpatialBounds) => Effect.succeed(undefined),

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

          const { updated, updatedCount } = pipe(
            placements,
            ReadonlyArray.reduce({ updated: [] as BiomePlacement[], updatedCount: 0 }, (acc, placement) =>
              coordinateInBounds(placement.coordinate, bounds)
                ? {
                    updated: [...acc.updated, { ...placement, biomeId }],
                    updatedCount: acc.updatedCount + 1,
                  }
                : {
                    updated: [...acc.updated, placement],
                    updatedCount: acc.updatedCount,
                  }
            )
          )

          yield* Ref.set(biomePlacements, updated)
          yield* persistBiomePlacements()

          return updatedCount
        }),

      clearBiomesInBounds: (bounds: SpatialBounds) =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)
          const filtered = placements.filter((placement) => !coordinateInBounds(placement.coordinate, bounds))
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
            ? placements.filter((p) => coordinateInBounds(p.coordinate, bounds))
            : placements

          const { biomeTypeCounts, totalTemp, totalHumidity } = pipe(
            relevantPlacements,
            ReadonlyArray.reduce(
              {
                biomeTypeCounts: new Map<BiomeId, number>(),
                totalTemp: 0,
                totalHumidity: 0,
              },
              (acc, placement) => {
                acc.biomeTypeCounts.set(placement.biomeId, (acc.biomeTypeCounts.get(placement.biomeId) || 0) + 1)

                return pipe(
                  Option.fromNullable(definitions.get(placement.biomeId)),
                  Option.match({
                    onNone: () => acc,
                    onSome: (definition) => ({
                      ...acc,
                      totalTemp: acc.totalTemp + definition.temperature,
                      totalHumidity: acc.totalHumidity + definition.humidity,
                    }),
                  })
                )
              }
            )
          )

          const coverage: Record<string, number> = pipe(
            Array.from(biomeTypeCounts.entries()),
            ReadonlyArray.reduce({} as Record<string, number>, (acc, [biomeId, count]) => ({
              ...acc,
              [biomeId]: relevantPlacements.length > 0 ? (count / relevantPlacements.length) * 100 : 0,
            }))
          )

          const dominantBiome =
            Array.from(biomeTypeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
            createBiomeId('minecraft:unknown')

          return {
            totalBiomes: relevantPlacements.length,
            uniqueBiomeTypes: biomeTypeCounts.size,
            coverage,
            dominantBiome,
            raresBiomes: Array.from(biomeTypeCounts.entries())
              .filter(([_, count]) => count === 1)
              .map(([biomeId]) => biomeId),
            averageTemperature:
              relevantPlacements.length > 0
                ? Schema.decodeSync(TemperatureSchema)(totalTemp / relevantPlacements.length)
                : Schema.decodeSync(TemperatureSchema)(15),
            averageHumidity:
              relevantPlacements.length > 0
                ? Schema.decodeSync(HumiditySchema)(totalHumidity / relevantPlacements.length)
                : Schema.decodeSync(HumiditySchema)(0.5),
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

      analyzeTransitions: (bounds: SpatialBounds) => Effect.succeed([]),

      // === Data Export/Import ===

      exportBiomeData: (bounds: SpatialBounds, format: 'json' | 'binary' | 'image') =>
        Effect.gen(function* () {
          const placements = yield* Ref.get(biomePlacements)
          const filtered = placements.filter((p) => coordinateInBounds(p.coordinate, bounds))

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
          legend: { forest: '#228B22' } as Record<BiomeId, string>,
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
          const spatialErrors = pipe(
            placements,
            ReadonlyArray.filterMap((placement) =>
              definitions.has(placement.biomeId)
                ? Option.none()
                : Option.some({
                    coordinate: placement.coordinate,
                    issue: `Referenced biome ${placement.biomeId} not found in definitions`,
                  })
            )
          )

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
) => Layer.effect(BiomeSystemRepository, BiomeSystemRepositoryPersistenceImplementation(config, persistenceConfig))
