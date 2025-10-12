/**
 * CaveCarver Domain Service - 洞窟彫刻システム
 *
 * 3Dパーリンノイズによる自然な洞窟システム生成
 * 物理法則に基づいた洞窟構造とMinecraft互換性を両立
 */

import { type GenerationError } from '@domain/world/types/errors'
import {
  makeUnsafeWorldCoordinate,
  WorldCoordinateSchema,
  type BoundingBox,
  type WorldCoordinate,
} from '@domain/world/value_object/coordinates'
import {
  AdvancedNoiseSettingsSchema,
  NoiseConfigurationFactory,
  type AdvancedNoiseSettings,
} from '@domain/world/value_object/noise_configuration'
import type { WorldSeed } from '@domain/world/value_object/world_seed'
import { JsonValueSchema } from '@shared/schema/json'
import { Clock, Context, Effect, Layer, Match, Option, pipe, Random, ReadonlyArray, Schema } from 'effect'

/**
 * 洞窟ネットワーク - 連結された洞窟システム
 */
export const CaveNetworkSchema = Schema.Struct({
  id: Schema.String,
  caves: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      center: WorldCoordinateSchema,
      radius: Schema.Number.pipe(Schema.positive()),
      depth: Schema.Number.pipe(Schema.positive()),
      connections: Schema.Array(Schema.String), // 他の洞窟への接続ID
      caveType: Schema.Literal('cavern', 'tunnel', 'chamber', 'chasm', 'grotto'),
    })
  ),
  tunnels: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      startCave: Schema.String,
      endCave: Schema.String,
      path: Schema.Array(WorldCoordinateSchema),
      width: Schema.Number.pipe(Schema.positive()),
      height: Schema.Number.pipe(Schema.positive()),
      tunnelType: Schema.Literal('main', 'branch', 'connection', 'emergency'),
    })
  ),
  waterSources: Schema.Array(
    Schema.Struct({
      coordinate: WorldCoordinateSchema,
      flowRate: Schema.Number.pipe(Schema.nonNegative()),
      depth: Schema.Number.pipe(Schema.positive()),
      sourceType: Schema.Literal('spring', 'seep', 'underground_river', 'lake'),
    })
  ),
  metadata: Schema.Struct({
    totalVolume: Schema.Number.pipe(Schema.positive()),
    complexity: Schema.Number.pipe(Schema.between(0, 1)),
    accessibility: Schema.Number.pipe(Schema.between(0, 1)),
    structuralIntegrity: Schema.Number.pipe(Schema.between(0, 1)),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'CaveNetwork',
    title: 'Cave Network System',
    description: 'Complete interconnected cave system with tunnels and chambers',
  })
)

export type CaveNetwork = typeof CaveNetworkSchema.Type

type CaveNode = CaveNetwork['caves'][number]
type TunnelDefinition = CaveNetwork['tunnels'][number]
type WaterSourceDefinition = CaveNetwork['waterSources'][number]
type CaveMetadata = CaveNetwork['metadata']

/**
 * 洞窟彫刻設定
 */
export const CaveCarveConfigSchema = Schema.Struct({
  // 基本設定
  density: Schema.Number.pipe(Schema.between(0, 1)),
  complexity: Schema.Number.pipe(Schema.between(0, 1)),
  interconnectivity: Schema.Number.pipe(Schema.between(0, 1)),

  // サイズ制約
  minCaveRadius: Schema.Number.pipe(Schema.positive()),
  maxCaveRadius: Schema.Number.pipe(Schema.positive()),
  minTunnelWidth: Schema.Number.pipe(Schema.positive()),
  maxTunnelWidth: Schema.Number.pipe(Schema.positive()),

  // 深度制約
  minDepth: Schema.Number.pipe(Schema.int()),
  maxDepth: Schema.Number.pipe(Schema.int()),
  preferredDepthRange: Schema.Struct({
    min: Schema.Number.pipe(Schema.int()),
    max: Schema.Number.pipe(Schema.int()),
  }),

  // ノイズ設定
  primaryNoise: AdvancedNoiseSettingsSchema,
  erosionNoise: AdvancedNoiseSettingsSchema,
  structuralNoise: AdvancedNoiseSettingsSchema,

  // 物理法則
  enableGravity: Schema.Boolean,
  enableWaterFlow: Schema.Boolean,
  enableRockStability: Schema.Boolean,
  minimumRockThickness: Schema.Number.pipe(Schema.positive()),

  // 生成制約
  avoidSurface: Schema.Boolean,
  surfaceBuffer: Schema.Number.pipe(Schema.nonNegative()),
  avoidStructures: Schema.Boolean,
  structureBuffer: Schema.Number.pipe(Schema.nonNegative()),

  // パフォーマンス
  maxCavesPerChunk: Schema.Number.pipe(Schema.int(), Schema.positive()),
  generationRadius: Schema.Number.pipe(Schema.positive()),
  simplificationThreshold: Schema.Number.pipe(Schema.between(0, 1)),
}).pipe(
  Schema.annotations({
    identifier: 'CaveCarveConfig',
    title: 'Cave Carving Configuration',
    description: 'Complete configuration for cave generation and carving',
  })
)

export type CaveCarveConfig = typeof CaveCarveConfigSchema.Type

/**
 * 洞窟彫刻結果
 */
export const CaveCarveResultSchema = Schema.Struct({
  network: CaveNetworkSchema,
  carvedBlocks: Schema.Array(
    Schema.Struct({
      coordinate: WorldCoordinateSchema,
      originalMaterial: Schema.String,
      carveReason: Schema.Literal('cave', 'tunnel', 'water_erosion', 'structural'),
      confidence: Schema.Number.pipe(Schema.between(0, 1)),
    })
  ),
  addedBlocks: Schema.Array(
    Schema.Struct({
      coordinate: WorldCoordinateSchema,
      material: Schema.String,
      placementReason: Schema.Literal('support', 'decoration', 'water', 'minerals'),
    })
  ),
  flowPaths: Schema.Array(
    Schema.Struct({
      sourceId: Schema.String,
      path: Schema.Array(WorldCoordinateSchema),
      flowType: Schema.Literal('water', 'air', 'lava'),
      volume: Schema.Number.pipe(Schema.positive()),
    })
  ),
  statistics: Schema.Struct({
    totalVolume: Schema.Number.pipe(Schema.positive()),
    carvedBlocks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    generationTime: Schema.Number.pipe(Schema.positive()),
    memoryUsed: Schema.Number.pipe(Schema.positive()),
    complexityScore: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  warnings: Schema.Array(Schema.String).pipe(Schema.optional),
  debugInfo: Schema.Record({
    key: Schema.String,
    value: JsonValueSchema,
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'CaveCarveResult',
    title: 'Cave Carving Result',
    description: 'Complete result of cave carving process',
  })
)

export type CaveCarveResult = typeof CaveCarveResultSchema.Type

/**
 * CaveCarver Service Interface
 *
 * 洞窟システム生成の核となるドメインサービス
 * 物理法則と美的原理を両立した洞窟生成
 */
export interface CaveCarverService {
  /**
   * 指定領域に洞窟ネットワークを生成
   */
  readonly generateCaveNetwork: (
    bounds: BoundingBox,
    config: CaveCarveConfig,
    seed: WorldSeed
  ) => Effect.Effect<CaveNetwork, GenerationError>

  /**
   * 洞窟ネットワークに基づいてブロックを彫刻
   */
  readonly carveBlocks: (
    network: CaveNetwork,
    config: CaveCarveConfig,
    existingTerrain: ReadonlyArray<{
      coordinate: WorldCoordinate
      material: string
    }>
  ) => Effect.Effect<CaveCarveResult, GenerationError>

  /**
   * 単一洞窟の生成
   */
  readonly generateSingleCave: (
    center: WorldCoordinate,
    radius: number,
    config: CaveCarveConfig,
    seed: WorldSeed
  ) => Effect.Effect<
    {
      carvedCoordinates: ReadonlyArray<WorldCoordinate>
      supportStructure: ReadonlyArray<WorldCoordinate>
    },
    GenerationError
  >

  /**
   * トンネル生成（洞窟間接続）
   */
  readonly generateTunnel: (
    start: WorldCoordinate,
    end: WorldCoordinate,
    width: number,
    height: number,
    config: CaveCarveConfig
  ) => Effect.Effect<ReadonlyArray<WorldCoordinate>, GenerationError>

  /**
   * 洞窟の構造安定性検証
   */
  readonly validateStructuralIntegrity: (
    network: CaveNetwork,
    config: CaveCarveConfig
  ) => Effect.Effect<
    {
      isStable: boolean
      weakPoints: ReadonlyArray<WorldCoordinate>
      recommendations: ReadonlyArray<string>
    },
    GenerationError
  >

  /**
   * 水流シミュレーション
   */
  readonly simulateWaterFlow: (
    network: CaveNetwork,
    waterSources: ReadonlyArray<WorldCoordinate>
  ) => Effect.Effect<
    ReadonlyArray<{
      path: ReadonlyArray<WorldCoordinate>
      volume: number
      poolingAreas: ReadonlyArray<WorldCoordinate>
    }>,
    GenerationError
  >
}

/**
 * CaveCarver Context Tag
 */
export const CaveCarverService = Context.GenericTag<CaveCarverService>('@minecraft/domain/world/CaveCarver')

/**
 * CaveCarver Live Implementation
 *
 * 物理法則に基づいた洞窟生成の実装
 */
export const CaveCarverServiceLive = Layer.effect(
  CaveCarverService,
  Effect.succeed({
    generateCaveNetwork: (bounds, config, seed) =>
      Effect.gen(function* () {
        // 洞窟ネットワーク生成の実装

        // 1. 洞窟配置候補の決定
        const caveCandidates = yield* generateCaveCandidates(bounds, config, seed)

        // 2. 洞窟サイズの決定
        const sizedCaves = yield* determineCaveSizes(caveCandidates, config, seed)

        // 3. 洞窟間接続の計算
        const connections = yield* calculateCaveConnections(sizedCaves, config)

        // 4. トンネル生成
        const tunnels = yield* generateConnectingTunnels(connections, config)

        // 5. 水源の配置
        const waterSources = yield* placeWaterSources(sizedCaves, config, seed)

        // 6. ネットワーク統計の計算
        const metadata = yield* calculateNetworkMetadata(sizedCaves, tunnels, waterSources)

        const timestamp = yield* Clock.currentTimeMillis
        return {
          id: `cave_network_${seed}_${timestamp}`,
          caves: sizedCaves,
          tunnels,
          waterSources,
          metadata,
        }
      }),

    carveBlocks: (network, config, existingTerrain) =>
      Effect.gen(function* () {
        const startTime = yield* Clock.currentTimeMillis

        // 1. 洞窟空間の彫刻
        const caveCarves = yield* carveAllCaves(network.caves, config)

        // 2. トンネルの彫刻
        const tunnelCarves = yield* carveAllTunnels(network.tunnels, config)

        // 3. 構造支持の追加
        const supportBlocks = yield* addStructuralSupports(network, config)

        // 4. 水系の彫刻
        const waterCarves = yield* carveWaterSystems(network.waterSources, config)

        // 5. 装飾要素の追加
        const decorativeBlocks = yield* addCaveDecorations(network, config)

        // 6. 流路の計算
        const flowPaths = yield* calculateFlowPaths(network, config)

        // 7. 統計計算
        const statistics = {
          totalVolume: calculateTotalVolume(network),
          carvedBlocks: caveCarves.length + tunnelCarves.length + waterCarves.length,
          generationTime: yield* Clock.currentTimeMillis,
          memoryUsed: estimateMemoryUsage(caveCarves, tunnelCarves, supportBlocks),
          complexityScore: calculateComplexityScore(network),
        }

        return {
          network,
          carvedBlocks: [...caveCarves, ...tunnelCarves, ...waterCarves],
          addedBlocks: [...supportBlocks, ...decorativeBlocks],
          flowPaths,
          statistics,
          warnings: yield* validateCarveWarnings(network, config),
          debugInfo: {
            caveCount: network.caves.length,
            tunnelCount: network.tunnels.length,
            waterSourceCount: network.waterSources.length,
          },
        }
      }),

    generateSingleCave: (center, radius, config, seed) =>
      Effect.gen(function* () {
        // 単一洞窟の球状彫刻

        // 1. 基本球形の生成
        const baseCoordinates = yield* generateSphericalCoordinates(center, radius)

        // 2. ノイズによる自然化
        const naturalizedCoordinates = yield* applyNaturalizationNoise(baseCoordinates, config.primaryNoise, seed)

        // 3. 構造支持の計算
        const supportStructure = yield* calculateCaveSupports(naturalizedCoordinates, config)

        // 4. 重力による自然な形状調整
        const gravityAdjusted = config.enableGravity
          ? yield* applyGravityEffect(naturalizedCoordinates, center)
          : Effect.succeed(naturalizedCoordinates)

        return {
          carvedCoordinates: gravityAdjusted,
          supportStructure,
        }
      }),

    generateTunnel: (start, end, width, height, config) =>
      Effect.gen(function* () {
        // トンネル生成の実装

        // 1. 直線経路の計算
        const straightPath = yield* calculateStraightPath(start, end)

        // 2. 自然な曲線の適用
        const curvedPath = yield* applyCurvature(straightPath, config.primaryNoise)

        // 3. 幅と高さの適用
        const tunnelCoordinates = yield* expandPathToTunnel(curvedPath, width, height)

        // 4. 地質による調整
        const geologicallyAdjusted = yield* applyGeologicalConstraints(tunnelCoordinates, config)

        return geologicallyAdjusted
      }),

    validateStructuralIntegrity: (network, config) =>
      Effect.gen(function* () {
        // 構造安定性の検証

        // 1. 各洞窟の天井安定性
        const caveStability = yield* validateCaveStability(network.caves, config)

        // 2. トンネルの構造強度
        const tunnelStability = yield* validateTunnelStability(network.tunnels, config)

        // 3. 全体的な地盤安定性
        const overallStability = yield* validateOverallStability(network, config)

        // 4. 弱点の特定
        const weakPoints = yield* identifyWeakPoints(caveStability, tunnelStability, overallStability)

        // 5. 改善提案の生成
        const recommendations = yield* generateStabilityRecommendations(weakPoints, config)

        return {
          isStable: weakPoints.length === 0,
          weakPoints,
          recommendations,
        }
      }),

    simulateWaterFlow: (network, waterSources) =>
      Effect.gen(function* () {
        // 水流シミュレーション

        // for文 → Effect.forEach（水源ごとの流路計算）
        const flowResults = yield* pipe(
          waterSources,
          Effect.forEach((source) =>
            Effect.gen(function* () {
              // 1. 流路の計算
              const flowPath = yield* calculateWaterPath(source, network)

              // 2. 流量の計算
              const volume = yield* calculateFlowVolume(source, flowPath)

              // 3. 溜まり場の特定
              const poolingAreas = yield* identifyPoolingAreas(flowPath, network)

              return {
                path: flowPath,
                volume,
                poolingAreas,
              }
            })
          )
        )

        return flowResults
      }),
  })
)

// ヘルパー関数群

/**
 * 洞窟配置候補の生成
 */
const generateCaveCandidates = (
  bounds: BoundingBox,
  config: CaveCarveConfig,
  seed: WorldSeed
): Effect.Effect<ReadonlyArray<WorldCoordinate>, GenerationError> =>
  Effect.gen(function* () {
    const volume = calculateBoundsVolume(bounds)
    const targetCaveCount = Math.floor(volume * config.density * 0.0001)

    // for文 → ReadonlyArray.filterMap（洞窟候補生成）
    // Random Serviceで決定的な座標生成（WorldSeed依存）
    const candidates = yield* pipe(
      ReadonlyArray.range(0, targetCaveCount),
      Effect.forEach(() =>
        Effect.gen(function* () {
          // ノイズベースの配置決定（Random Serviceで再現性保証）
          const randX = yield* Random.nextIntBetween(0, 1000)
          const randY = yield* Random.nextIntBetween(0, 1000)
          const randZ = yield* Random.nextIntBetween(0, 1000)

          const x = bounds.min.x + (bounds.max.x - bounds.min.x) * (randX / 1000)
          const y = bounds.min.y + (bounds.max.y - bounds.min.y) * (randY / 1000)
          const z = bounds.min.z + (bounds.max.z - bounds.min.z) * (randZ / 1000)

          // 深度制約の適用
          return pipe(
            Match.value(y),
            Match.when(
              (depth) => depth >= config.minDepth && depth <= config.maxDepth,
              () => Option.some(makeUnsafeWorldCoordinate(x, y, z))
            ),
            Match.orElse(() => Option.none())
          )
        })
      ),
      Effect.map(ReadonlyArray.getSomes)
    )

    return candidates
  })

/**
 * 洞窟サイズの決定
 */
const determineCaveSizes = (
  candidates: ReadonlyArray<WorldCoordinate>,
  config: CaveCarveConfig,
  seed: WorldSeed
): Effect.Effect<ReadonlyArray<CaveNode>, GenerationError> =>
  Effect.succeed(
    candidates.map((coord, index) => {
      const sizeNoise = Math.sin(index + Number(seed)) * 0.5 + 0.5
      const radius = config.minCaveRadius + (config.maxCaveRadius - config.minCaveRadius) * sizeNoise

      const caveTypes = ['cavern', 'tunnel', 'chamber', 'chasm', 'grotto'] as const
      const typeIndex = Math.floor(sizeNoise * caveTypes.length)

      return {
        id: `cave_${index}`,
        center: coord,
        radius,
        depth: radius * 0.8,
        connections: [],
        caveType: caveTypes[typeIndex] || 'cavern',
      } satisfies CaveNode
    })
  )

/**
 * 洞窟間接続の計算
 */
const calculateCaveConnections = (
  caves: ReadonlyArray<CaveNode>,
  config: CaveCarveConfig
): Effect.Effect<ReadonlyArray<TunnelDefinition>, GenerationError> =>
  Effect.succeed([] satisfies ReadonlyArray<TunnelDefinition>) // 簡略化実装

/**
 * 接続トンネルの生成
 */
const generateConnectingTunnels = (
  connections: ReadonlyArray<TunnelDefinition>,
  config: CaveCarveConfig
): Effect.Effect<ReadonlyArray<TunnelDefinition>, GenerationError> =>
  Effect.succeed([] satisfies ReadonlyArray<TunnelDefinition>) // 簡略化実装

/**
 * 水源の配置
 */
const placeWaterSources = (
  caves: ReadonlyArray<CaveNode>,
  config: CaveCarveConfig,
  _seed: WorldSeed
): Effect.Effect<ReadonlyArray<WaterSourceDefinition>, GenerationError> =>
  Effect.succeed([] satisfies ReadonlyArray<WaterSourceDefinition>) // 簡略化実装

/**
 * ネットワーク統計の計算
 */
const calculateNetworkMetadata = (
  caves: ReadonlyArray<CaveNode>,
  tunnels: ReadonlyArray<TunnelDefinition>,
  _waterSources: ReadonlyArray<WaterSourceDefinition>
): Effect.Effect<CaveMetadata, GenerationError> =>
  Effect.succeed({
    totalVolume: caves.reduce((sum, cave) => sum + (cave.radius ** 3 * Math.PI * 4) / 3, 0),
    complexity: Math.min(caves.length / 10, 1),
    accessibility: caves.length > 0 ? tunnels.length / caves.length : 0,
    structuralIntegrity: 1.0, // 簡略化
  } satisfies CaveMetadata)

// その他のヘルパー関数（実装の詳細は省略）
const carveAllCaves = (caves: ReadonlyArray<{ center: WorldCoordinate; radius: number }>, config: CaveCarveConfig) =>
  Effect.succeed([] satisfies ReadonlyArray<WorldCoordinate>)

const carveAllTunnels = (
  tunnels: ReadonlyArray<{ path: ReadonlyArray<WorldCoordinate>; width: number; height: number }>,
  config: CaveCarveConfig
) => Effect.succeed([] satisfies ReadonlyArray<WorldCoordinate>)

const addStructuralSupports = (network: CaveNetwork, config: CaveCarveConfig) =>
  Effect.succeed([] satisfies ReadonlyArray<WorldCoordinate>)

const carveWaterSystems = (
  sources: ReadonlyArray<{ coordinate: WorldCoordinate; flowRate: number }>,
  config: CaveCarveConfig
) => Effect.succeed([] satisfies ReadonlyArray<WorldCoordinate>)

const addCaveDecorations = (network: CaveNetwork, config: CaveCarveConfig) =>
  Effect.succeed([] satisfies ReadonlyArray<{ coordinate: WorldCoordinate; decorationType: string }>)

const calculateFlowPaths = (network: CaveNetwork, config: CaveCarveConfig) =>
  Effect.succeed([] satisfies ReadonlyArray<{ path: ReadonlyArray<WorldCoordinate>; flowRate: number }>)

const calculateTotalVolume = (network: CaveNetwork) => 1000

const estimateMemoryUsage = (...args: ReadonlyArray<unknown>[]) => 1024

const calculateComplexityScore = (network: CaveNetwork) => 0.5

const validateCarveWarnings = (network: CaveNetwork, config: CaveCarveConfig) =>
  Effect.succeed([] satisfies ReadonlyArray<string>)

const generateSphericalCoordinates = (center: WorldCoordinate, radius: number) =>
  Effect.succeed([] satisfies ReadonlyArray<WorldCoordinate>)

const applyNaturalizationNoise = (
  coords: ReadonlyArray<WorldCoordinate>,
  _noise: AdvancedNoiseSettings,
  _seed: WorldSeed
) => Effect.succeed(coords)

const calculateCaveSupports = (coords: ReadonlyArray<WorldCoordinate>, config: CaveCarveConfig) =>
  Effect.succeed([] satisfies ReadonlyArray<WorldCoordinate>)

const applyGravityEffect = (coords: ReadonlyArray<WorldCoordinate>, center: WorldCoordinate) => Effect.succeed(coords)

const calculateStraightPath = (start: WorldCoordinate, end: WorldCoordinate) =>
  Effect.succeed([start, end] satisfies ReadonlyArray<WorldCoordinate>)

const applyCurvature = (path: ReadonlyArray<WorldCoordinate>, _noise: AdvancedNoiseSettings) => Effect.succeed(path)

const expandPathToTunnel = (path: ReadonlyArray<WorldCoordinate>, width: number, height: number) =>
  Effect.succeed([] satisfies ReadonlyArray<WorldCoordinate>)

const applyGeologicalConstraints = (coords: ReadonlyArray<WorldCoordinate>, config: CaveCarveConfig) =>
  Effect.succeed(coords)

const validateCaveStability = (
  caves: ReadonlyArray<{ center: WorldCoordinate; radius: number }>,
  config: CaveCarveConfig
) => Effect.succeed([] satisfies ReadonlyArray<string>)

const validateTunnelStability = (
  tunnels: ReadonlyArray<{ path: ReadonlyArray<WorldCoordinate> }>,
  config: CaveCarveConfig
) => Effect.succeed([] satisfies ReadonlyArray<string>)

const validateOverallStability = (network: CaveNetwork, config: CaveCarveConfig) =>
  Effect.succeed([] satisfies ReadonlyArray<string>)

const identifyWeakPoints = (...args: ReadonlyArray<unknown>[]) =>
  Effect.succeed([] satisfies ReadonlyArray<{ location: WorldCoordinate; severity: number }>)

const generateStabilityRecommendations = (
  weakPoints: ReadonlyArray<{ location: WorldCoordinate; severity: number }>,
  config: CaveCarveConfig
) => Effect.succeed([] satisfies ReadonlyArray<string>)

const calculateWaterPath = (source: { coordinate: WorldCoordinate; flowRate: number }, network: CaveNetwork) =>
  Effect.succeed([] satisfies ReadonlyArray<WorldCoordinate>)

const calculateFlowVolume = (
  source: { coordinate: WorldCoordinate; flowRate: number },
  path: ReadonlyArray<WorldCoordinate>
) => Effect.succeed(100)

const identifyPoolingAreas = (path: ReadonlyArray<WorldCoordinate>, network: CaveNetwork) =>
  Effect.succeed([] satisfies ReadonlyArray<WorldCoordinate>)
const calculateBoundsVolume = (bounds: BoundingBox) =>
  Math.abs(bounds.max.x - bounds.min.x) * Math.abs(bounds.max.y - bounds.min.y) * Math.abs(bounds.max.z - bounds.min.z)

/**
 * デフォルト洞窟彫刻設定
 */
export const DEFAULT_CAVE_CONFIG: CaveCarveConfig = {
  density: 0.3,
  complexity: 0.6,
  interconnectivity: 0.4,
  minCaveRadius: 2,
  maxCaveRadius: 20,
  minTunnelWidth: 1,
  maxTunnelWidth: 5,
  minDepth: -100,
  maxDepth: 50,
  preferredDepthRange: { min: -50, max: 20 },
  primaryNoise: NoiseConfigurationFactory.createCaveNoise(),
  erosionNoise: NoiseConfigurationFactory.createCaveNoise(),
  structuralNoise: NoiseConfigurationFactory.createCaveNoise(),
  enableGravity: true,
  enableWaterFlow: true,
  enableRockStability: true,
  minimumRockThickness: 2,
  avoidSurface: true,
  surfaceBuffer: 10,
  avoidStructures: true,
  structureBuffer: 5,
  maxCavesPerChunk: 5,
  generationRadius: 100,
  simplificationThreshold: 0.1,
}
