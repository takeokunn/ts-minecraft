/**
 * TerrainGenerator Domain Service - 地形生成アルゴリズム
 *
 * 高度マップからブロック配置を行う純粋関数型ドメインサービス
 * Minecraft互換の地形生成と数学的正確性を両立
 */

import {
  BoundingBoxSchema,
  makeUnsafeWorldCoordinate,
  WorldCoordinateSchema,
  type BoundingBox,
  type WorldCoordinate,
  type WorldCoordinate2D,
} from '@domain/biome/value_object/coordinates'
import type { WorldSeed } from '@domain/shared/value_object/world_seed'
import { type GenerationError } from '@domain/world/types/errors'
import {
  AdvancedNoiseSettings,
  AdvancedNoiseSettingsSchema,
  NoiseConfigurationFactory,
} from '@domain/world/value_object/noise_configuration'
import { JsonRecordSchema, JsonValueSchema } from '@shared/schema/json'
import { Clock, Context, Effect, Layer, Match, Option, pipe, ReadonlyArray, Schema } from 'effect'

/**
 * 高度マップ - ワールド座標における高度データ
 */
import { chunkGenerationCounter, chunkGenerationDuration } from '@application/observability/metrics'

export const HeightMapSchema = Schema.Struct({
  bounds: BoundingBoxSchema,
  resolution: Schema.Number.pipe(Schema.int(), Schema.positive()),
  heights: Schema.Array(Schema.Array(Schema.Number.pipe(Schema.finite(), Schema.between(-2048, 2047)))),
  metadata: Schema.Struct({
    generationTime: Schema.Number,
    algorithm: Schema.String,
    seed: Schema.BigInt,
    noiseSettings: AdvancedNoiseSettingsSchema,
  }),
}).pipe(
  Schema.annotations({
    identifier: 'HeightMap',
    title: 'Terrain Height Map',
    description: 'Two-dimensional height field for terrain generation',
  })
)

export type HeightMap = typeof HeightMapSchema.Type

/**
 * 地形レイヤー定義
 */
/**
 * バイオームマップ - ワールド座標におけるバイオームデータ
 */
export const BiomeMapSchema = Schema.Struct({
  bounds: BoundingBoxSchema,
  resolution: Schema.Number.pipe(Schema.int(), Schema.positive()),
  biomes: Schema.Array(Schema.Array(Schema.String)),
  metadata: Schema.Struct({
    generationTime: Schema.Number,
    algorithm: Schema.String,
    seed: Schema.BigInt,
  }),
}).pipe(
  Schema.annotations({
    identifier: 'BiomeMap',
    title: 'Biome Distribution Map',
    description: 'Two-dimensional biome distribution for world generation',
  })
)

export type BiomeMap = typeof BiomeMapSchema.Type

/**
 * 地形コンテキスト - 構造物生成に必要な地形情報
 */
export const TerrainContextSchema = Schema.Struct({
  heightMap: HeightMapSchema,
  biomeMap: BiomeMapSchema,
  existingStructures: Schema.Array(JsonRecordSchema),
}).pipe(
  Schema.annotations({
    identifier: 'TerrainContext',
    title: 'Terrain Context',
    description: 'Complete terrain information for structure generation',
  })
)

export type TerrainContext = typeof TerrainContextSchema.Type

export const TerrainLayerSchema = Schema.Struct({
  name: Schema.String,
  materialType: Schema.Literal(
    'bedrock',
    'stone',
    'dirt',
    'grass',
    'sand',
    'gravel',
    'clay',
    'coal_ore',
    'iron_ore',
    'water',
    'lava'
  ),
  minHeight: Schema.Number.pipe(Schema.int()),
  maxHeight: Schema.Number.pipe(Schema.int()),
  density: Schema.Number.pipe(Schema.between(0, 1)),
  noiseInfluence: Schema.Number.pipe(Schema.between(0, 1)),
}).pipe(
  Schema.annotations({
    title: 'Terrain Layer',
    description: 'Material layer definition for terrain generation',
  })
)

export type TerrainLayer = typeof TerrainLayerSchema.Type

/**
 * 地形生成設定
 */
export const TerrainGenerationConfigSchema = Schema.Struct({
  // 基本設定
  seaLevel: Schema.Number.pipe(Schema.int(), Schema.between(-2048, 2047)),
  bedrockLevel: Schema.Number.pipe(Schema.int(), Schema.between(-2048, 0)),

  // 高度設定
  minHeight: Schema.Number.pipe(Schema.int(), Schema.between(-2048, 2047)),
  maxHeight: Schema.Number.pipe(Schema.int(), Schema.between(-2048, 2047)),
  heightVariation: Schema.Number.pipe(Schema.between(0, 1000)),

  // ノイズ設定
  primaryNoise: AdvancedNoiseSettingsSchema,
  secondaryNoise: AdvancedNoiseSettingsSchema.pipe(Schema.optional),

  // レイヤー構成
  layers: Schema.Array(TerrainLayerSchema),

  // 生成制約
  generateCaves: Schema.Boolean,
  generateOres: Schema.Boolean,
  generateStructures: Schema.Boolean,

  // パフォーマンス設定
  enableMultiThreading: Schema.Boolean,
  chunkBatchSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  memoryLimit: Schema.Number.pipe(Schema.positive()).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'TerrainGenerationConfig',
    title: 'Terrain Generation Configuration',
    description: 'Complete configuration for terrain generation process',
  })
)

export type TerrainGenerationConfig = typeof TerrainGenerationConfigSchema.Type

/**
 * 地形生成結果
 */
const BlockPlacementMetadataSchema = Schema.Struct({
  density: Schema.Number.pipe(Schema.nonNegative()).pipe(Schema.optional),
  surface: Schema.Boolean.pipe(Schema.optional),
}).pipe(Schema.optional)

const BlockPlacementSchema = Schema.Struct({
  coordinate: WorldCoordinateSchema,
  blockType: Schema.String,
  metadata: BlockPlacementMetadataSchema,
})

export const TerrainGenerationResultSchema = Schema.Struct({
  heightMap: HeightMapSchema,
  blockPlacements: Schema.Array(BlockPlacementSchema),
  statistics: Schema.Struct({
    totalBlocks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    generationTime: Schema.Number.pipe(Schema.positive()),
    memoryUsed: Schema.Number.pipe(Schema.positive()),
    layerCounts: Schema.Record({
      key: Schema.String,
      value: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    }),
  }),
  warnings: Schema.Array(Schema.String).pipe(Schema.optional),
  debugInfo: Schema.Record({
    key: Schema.String,
    value: JsonValueSchema,
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'TerrainGenerationResult',
    title: 'Terrain Generation Result',
    description: 'Complete result of terrain generation process',
  })
)

export type TerrainGenerationResult = typeof TerrainGenerationResultSchema.Type

type LayerPlacement = {
  readonly coordinate: WorldCoordinate
  readonly material: TerrainLayer['materialType']
  readonly density: number
}

type BlockPlacementMetadata = typeof BlockPlacementMetadataSchema.Type

export type BlockPlacement = typeof BlockPlacementSchema.Type

/**
 * TerrainGenerator Service Interface
 *
 * 地形生成の核となるドメインサービス
 * 全ての地形生成アルゴリズムを統括する
 */
export interface TerrainGeneratorService {
  /**
   * 指定領域の高度マップを生成
   */
  readonly generateHeightMap: (
    bounds: BoundingBox,
    config: TerrainGenerationConfig,
    seed: WorldSeed
  ) => Effect.Effect<HeightMap, GenerationError>

  /**
   * 高度マップから完全な地形を生成
   */
  readonly generateTerrain: (
    heightMap: HeightMap,
    config: TerrainGenerationConfig
  ) => Effect.Effect<TerrainGenerationResult, GenerationError>

  /**
   * 特定座標の地形高度を計算（単点）
   */
  readonly calculateHeightAt: (
    coordinate: WorldCoordinate2D,
    config: TerrainGenerationConfig,
    seed: WorldSeed
  ) => Effect.Effect<number, GenerationError>

  /**
   * 地形レイヤーの配置を決定
   */
  readonly placeLayers: (
    heightMap: HeightMap,
    layers: ReadonlyArray<TerrainLayer>,
    config: TerrainGenerationConfig
  ) => Effect.Effect<ReadonlyArray<LayerPlacement>, GenerationError>

  /**
   * 地表面の決定（草、砂、石など）
   */
  readonly determineSurface: (
    coordinate: WorldCoordinate,
    height: number,
    config: TerrainGenerationConfig
  ) => Effect.Effect<string, GenerationError>

  /**
   * 地形生成の検証
   */
  readonly validateTerrain: (
    result: TerrainGenerationResult,
    config: TerrainGenerationConfig
  ) => Effect.Effect<ReadonlyArray<string>, GenerationError>
}

/**
 * TerrainGenerator Context Tag
 */
export const TerrainGeneratorService = Context.GenericTag<TerrainGeneratorService>(
  '@minecraft/domain/world/TerrainGenerator'
)

/**
 * TerrainGenerator Live Implementation
 *
 * Effect-TS純粋関数による実装
 * 数学的正確性とパフォーマンスを両立
 */
export const TerrainGeneratorServiceLive = Layer.effect(
  TerrainGeneratorService,
  Effect.succeed({
    generateHeightMap: (bounds, config, seed) =>
      Effect.gen(function* () {
        // 高度マップ生成の実装

        // 1. ノイズベース高度生成
        const baseHeights = yield* generateBaseHeights(bounds, config.primaryNoise, seed)

        // 2. セカンダリノイズによる詳細化
        const detailedHeights = config.secondaryNoise
          ? yield* applySecondaryNoise(baseHeights, config.secondaryNoise, seed)
          : Effect.succeed(baseHeights)

        // 3. 高度制約の適用
        const constrainedHeights = yield* applyHeightConstraints(detailedHeights, config.minHeight, config.maxHeight)

        // 4. 高度マップオブジェクトの構築
        const heightMap: HeightMap = {
          bounds,
          resolution: Math.ceil(Math.sqrt(constrainedHeights.length)),
          heights: chunkArray(constrainedHeights, Math.ceil(Math.sqrt(constrainedHeights.length))),
          metadata: {
            generationTime: yield* Clock.currentTimeMillis,
            algorithm: 'procedural_noise',
            seed: BigInt(seed.toString()),
            noiseSettings: config.primaryNoise,
          },
        }

        return heightMap
      }).pipe(
        Effect.annotateLogs({
          bounds: JSON.stringify(bounds),
          seed: seed.toString(),
          minHeight: String(config.minHeight),
          maxHeight: String(config.maxHeight),
          operation: 'generate_height_map',
        })
      ),

    generateTerrain: (heightMap, config) =>
      Effect.gen(function* () {
        const startTime = yield* Clock.currentTimeMillis

        // 1. レイヤー配置の計算
        const layerPlacements = yield* placeLayers(heightMap, config.layers, config)

        // 2. ブロック配置の決定
        const blockPlacements = yield* generateBlockPlacements(layerPlacements, config)

        // 3. 地表面材質の決定
        const surfacePlacements = yield* generateSurfacePlacements(heightMap, config)

        // 4. 統計情報の計算
        const endTime = yield* Clock.currentTimeMillis
        const duration = endTime - startTime
        const statistics = {
          totalBlocks: blockPlacements.length + surfacePlacements.length,
          generationTime: duration,
          memoryUsed: estimateMemoryUsage(blockPlacements, surfacePlacements),
          layerCounts: calculateLayerCounts(blockPlacements, surfacePlacements),
        }

        // 5. メトリクス記録
        yield* chunkGenerationDuration(duration)
        yield* chunkGenerationCounter.increment()

        return {
          heightMap,
          blockPlacements: [...blockPlacements, ...surfacePlacements],
          statistics,
          warnings: yield* validateGenerationWarnings(heightMap, config),
          debugInfo: {
            layerCount: config.layers.length,
            noiseType: config.primaryNoise.type,
            heightRange: `${config.minHeight}-${config.maxHeight}`,
          },
        }
      }).pipe(
        Effect.annotateLogs({
          totalBlocks: String(blockPlacements.length + surfacePlacements.length),
          generationTime: String(endTime - startTime),
          layerCount: String(config.layers.length),
          operation: 'generate_terrain',
        })
      ),

    calculateHeightAt: (coordinate, config, seed) =>
      Effect.gen(function* () {
        // 単点高度計算の実装

        // 1. ノイズ値の計算
        const noiseValue = yield* calculateNoiseAt(coordinate, config.primaryNoise, seed)

        // 2. 高度への変換
        const baseHeight = config.minHeight + ((noiseValue + 1) / 2) * (config.maxHeight - config.minHeight)

        // 3. セカンダリノイズの適用
        return yield* pipe(
          Match.value(config.secondaryNoise),
          Match.when(
            (secondary): secondary is undefined => secondary === undefined,
            () => Effect.succeed(Math.round(baseHeight))
          ),
          Match.orElse((secondary) =>
            Effect.gen(function* () {
              const secondaryValue = yield* calculateNoiseAt(coordinate, secondary, seed)
              const modifiedHeight = baseHeight + secondaryValue * config.heightVariation * 0.1
              const clampedHeight = Math.max(config.minHeight, Math.min(config.maxHeight, modifiedHeight))
              return Math.round(clampedHeight)
            })
          )
        )
      }),

    placeLayers: (heightMap, layers, config) =>
      Effect.gen(function* () {
        // メモリ枯渇防止: 3重ネストunbounded削除
        const placements = yield* pipe(
          ReadonlyArray.makeBy(heightMap.heights.length, (x) => x),
          Effect.forEach(
            (x) =>
              Effect.gen(function* () {
                return yield* pipe(
                  ReadonlyArray.makeBy(heightMap.heights[x].length, (z) => z),
                  Effect.forEach(
                    (z) =>
                      Effect.gen(function* () {
                        const surfaceHeight = heightMap.heights[x][z]

                        return yield* pipe(
                          layers,
                          Effect.forEach(
                            (layer) =>
                              pipe(
                                Match.value(surfaceHeight),
                                Match.when(
                                  (height) => height >= layer.minHeight && height <= layer.maxHeight,
                                  () =>
                                    Effect.gen(function* () {
                                      const densityModifier =
                                        layer.noiseInfluence > 0
                                          ? yield* calculateDensityModifier(x, z, layer.noiseInfluence)
                                          : 1.0

                                      const finalDensity = layer.density * densityModifier

                                      return yield* pipe(
                                        Match.value(finalDensity),
                                        Match.when(
                                          (density) => density > 0.5,
                                          (density) =>
                                            Effect.succeed(
                                              Option.some<LayerPlacement>({
                                                coordinate: makeUnsafeWorldCoordinate(x, surfaceHeight, z),
                                                material: layer.materialType,
                                                density,
                                              })
                                            )
                                        ),
                                        Match.orElse(() => Effect.succeed(Option.none()))
                                      )
                                    })
                                ),
                                Match.orElse(() => Effect.succeed(Option.none()))
                              ),
                            { concurrency: 4 }
                          ),
                          Effect.map(ReadonlyArray.getSomes)
                        )
                      }),
                    { concurrency: 4 }
                  ),
                  Effect.map(ReadonlyArray.flatten)
                )
              }),
            { concurrency: 2 }
          ),
          Effect.map(ReadonlyArray.flatten)
        )

        return placements
      }),

    determineSurface: (coordinate, height, config) =>
      Effect.gen(function* () {
        // 高度による地表面材質の決定
        return pipe(
          Match.value(true),
          Match.when(
            height < config.seaLevel - 10,
            () => 'sand' // 深海
          ),
          Match.when(
            height < config.seaLevel,
            () => 'gravel' // 浅海
          ),
          Match.when(
            height < config.seaLevel + 10,
            () => 'sand' // 海岸
          ),
          Match.when(
            height < config.seaLevel + 50,
            () => 'grass' // 平地
          ),
          Match.when(
            height < config.seaLevel + 100,
            () => 'stone' // 丘陵
          ),
          Match.orElse(() => 'stone') // 山地
        )
      }),

    validateTerrain: (result, config) =>
      Effect.gen(function* () {
        // 1. 高度範囲の検証
        const heights = result.heightMap.heights.flat()
        const minHeight = Math.min(...heights)
        const maxHeight = Math.max(...heights)

        // 2. ブロック密度の検証
        const totalArea = result.heightMap.heights.length * result.heightMap.heights[0].length
        const blockDensity = result.statistics.totalBlocks / totalArea

        // 3. 生成時間の検証
        const warnings = pipe(
          [
            [
              minHeight < config.minHeight,
              `Generated terrain below minimum height: ${minHeight} < ${config.minHeight}`,
            ],
            [
              maxHeight > config.maxHeight,
              `Generated terrain above maximum height: ${maxHeight} > ${config.maxHeight}`,
            ],
            [blockDensity < 0.1, `Low block density detected: ${blockDensity.toFixed(3)}`],
            [blockDensity > 10.0, `High block density detected: ${blockDensity.toFixed(3)}`],
            [result.statistics.generationTime > 10000, `Long generation time: ${result.statistics.generationTime}ms`],
          ] as const,
          ReadonlyArray.filterMap(([condition, message]) =>
            pipe(
              Match.value(condition),
              Match.when(
                (flag) => flag,
                () => Option.some(message)
              ),
              Match.orElse(() => Option.none<string>())
            )
          )
        )

        return Array.from(warnings)
      }),
  })
)

// ヘルパー関数群

/**
 * ベース高度生成（ノイズベース）
 */
const generateBaseHeights = (
  bounds: BoundingBox,
  _noiseSettings: AdvancedNoiseSettings,
  seed: WorldSeed
): Effect.Effect<ReadonlyArray<number>, GenerationError> =>
  Effect.gen(function* () {
    // ノイズ生成の実装（仮）
    // 実際の実装では noise_generation ドメインサービスを使用
    const width = Math.abs(bounds.max.x - bounds.min.x)
    const depth = Math.abs(bounds.max.z - bounds.min.z)
    const resolution = Math.min(width, depth, 256) // 最大解像度制限

    // ReadonlyArray.makeByで固定回数ループを配列生成に変換
    const heights = ReadonlyArray.makeBy(resolution * resolution, (i) => {
      // 簡易ノイズ（実際の実装では高度なノイズアルゴリズムを使用）
      const x = (i % resolution) / resolution
      const z = Math.floor(i / resolution) / resolution
      const noise = Math.sin(x * 10 + Number(seed)) * Math.cos(z * 10 + Number(seed))
      return noise * 100 // 簡易的な高度変換
    })

    return heights
  })

/**
 * セカンダリノイズの適用
 */
const applySecondaryNoise = (
  baseHeights: ReadonlyArray<number>,
  _secondaryNoise: AdvancedNoiseSettings,
  seed: WorldSeed
): Effect.Effect<ReadonlyArray<number>, GenerationError> =>
  Effect.gen(function* () {
    // セカンダリノイズによる詳細化
    return baseHeights.map((height, index) => {
      const secondaryValue = Math.sin(index * 0.1 + Number(seed)) * 0.5
      return height + secondaryValue * 20 // 細かい変動を追加
    })
  })

/**
 * 高度制約の適用
 */
const applyHeightConstraints = (
  heights: ReadonlyArray<number>,
  minHeight: number,
  maxHeight: number
): Effect.Effect<ReadonlyArray<number>, GenerationError> =>
  Effect.succeed(heights.map((height) => Math.max(minHeight, Math.min(maxHeight, Math.round(height)))))

/**
 * 配列のチャンク化
 */
const chunkArray = <T>(array: ReadonlyArray<T>, size: number): T[][] =>
  pipe(
    ReadonlyArray.makeBy(Math.ceil(array.length / size), (i) => i * size),
    ReadonlyArray.map((startIndex) => [...array.slice(startIndex, startIndex + size)])
  )

/**
 * ノイズ値の単点計算
 */
const calculateNoiseAt = (
  coordinate: WorldCoordinate2D,
  _noiseSettings: AdvancedNoiseSettings,
  seed: WorldSeed
): Effect.Effect<number, GenerationError> =>
  Effect.succeed(
    // 簡易ノイズ計算（実際の実装では noise_generation サービスを使用）
    Math.sin(coordinate.x * 0.01 + Number(seed)) * Math.cos(coordinate.z * 0.01 + Number(seed))
  )

/**
 * 密度修正値の計算
 */
const calculateDensityModifier = (x: number, z: number, influence: number): Effect.Effect<number, GenerationError> =>
  Effect.succeed(1.0 + Math.sin(x * 0.1) * Math.cos(z * 0.1) * influence * 0.5)

/**
 * ブロック配置の生成
 */
const generateBlockPlacements = (
  layerPlacements: ReadonlyArray<LayerPlacement>,
  _config: TerrainGenerationConfig
): Effect.Effect<ReadonlyArray<BlockPlacement>, GenerationError> =>
  Effect.succeed(
    layerPlacements.map((placement) => ({
      coordinate: placement.coordinate,
      blockType: placement.material,
      metadata: { density: placement.density } satisfies BlockPlacementMetadata,
    }))
  )

/**
 * 地表面配置の生成
 */
const generateSurfacePlacements = (
  heightMap: HeightMap,
  config: TerrainGenerationConfig
): Effect.Effect<ReadonlyArray<BlockPlacement>, GenerationError> =>
  Effect.gen(function* () {
    // メモリ枯渇防止: unbounded削除
    const placements = yield* pipe(
      ReadonlyArray.makeBy(heightMap.heights.length, (x) => x),
      Effect.forEach(
        (x) =>
          Effect.gen(function* () {
            return yield* pipe(
              ReadonlyArray.makeBy(heightMap.heights[x].length, (z) => z),
              Effect.forEach(
                (z) =>
                  Effect.gen(function* () {
                    const height = heightMap.heights[x][z]
                    const surfaceType = yield* determineSurfaceType(x, z, height, config)

                    return {
                      coordinate: makeUnsafeWorldCoordinate(x, height, z),
                      blockType: surfaceType,
                      metadata: { surface: true } satisfies BlockPlacementMetadata,
                    }
                  }),
                { concurrency: 4 }
              )
            )
          }),
        { concurrency: 2 }
      ),
      Effect.map(ReadonlyArray.flatten)
    )

    return placements
  })

/**
 * 地表面タイプの決定
 */
const determineSurfaceType = (
  x: number,
  z: number,
  height: number,
  config: TerrainGenerationConfig
): Effect.Effect<string, GenerationError> => Effect.succeed(height < config.seaLevel ? 'sand' : 'grass')

/**
 * メモリ使用量の推定
 */
const estimateMemoryUsage = (...placements: ReadonlyArray<BlockPlacement>[]): number => {
  const totalItems = placements.reduce((sum, arr) => sum + arr.length, 0)
  return totalItems * 64 // 64バイト/アイテムと仮定
}

/**
 * レイヤー数の計算
 */
const calculateLayerCounts = (...placements: ReadonlyArray<BlockPlacement>[]): Record<string, number> => {
  const counts: Record<string, number> = {}

  placements.flat().forEach((placement) => {
    counts[placement.blockType] = (counts[placement.blockType] || 0) + 1
  })

  return counts
}

/**
 * 生成警告の検証
 */
const validateGenerationWarnings = (
  heightMap: HeightMap,
  config: TerrainGenerationConfig
): Effect.Effect<ReadonlyArray<string>, GenerationError> => Effect.succeed([])

/**
 * デフォルト地形生成設定
 */
export const DEFAULT_TERRAIN_CONFIG: TerrainGenerationConfig = {
  seaLevel: 64,
  bedrockLevel: -2048,
  minHeight: -2048,
  maxHeight: 2047,
  heightVariation: 200,
  primaryNoise: NoiseConfigurationFactory.createTerrainNoise(),
  secondaryNoise: NoiseConfigurationFactory.createCaveNoise(),
  layers: [
    {
      name: 'bedrock',
      materialType: 'bedrock',
      minHeight: -2048,
      maxHeight: -2040,
      density: 1.0,
      noiseInfluence: 0.0,
    },
    {
      name: 'stone',
      materialType: 'stone',
      minHeight: -2040,
      maxHeight: 50,
      density: 1.0,
      noiseInfluence: 0.1,
    },
    {
      name: 'dirt',
      materialType: 'dirt',
      minHeight: 50,
      maxHeight: 63,
      density: 1.0,
      noiseInfluence: 0.2,
    },
  ],
  generateCaves: true,
  generateOres: true,
  generateStructures: true,
  enableMultiThreading: true,
  chunkBatchSize: 16,
  memoryLimit: 512 * 1024 * 1024, // 512MB
}
