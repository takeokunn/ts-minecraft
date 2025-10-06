/**
 * @fileoverview Generation Core Types
 * 世界生成システムの基本型定義
 */

import { Brand, Schema } from 'effect'
import { uuid } from '@domain/world/utils'
import { GENERATION_CONSTANTS } from '../constants'
import { ChunkPosition, Vector3D, WorldSeed } from './index'

// === 生成識別子型 ===

/** 生成セッションID - 生成処理の一意識別子 */
export type GenerationSessionId = string & Brand.Brand<'GenerationSessionId'>

export const GenerationSessionIdSchema = Schema.String.pipe(
  uuid(),
  Schema.brand('GenerationSessionId'),
  Schema.annotations({
    title: 'Generation Session ID',
    description: 'Unique identifier for a generation session',
  })
)

/** 生成リクエストID - 個別生成リクエストの識別子 */
export type GenerationRequestId = string & Brand.Brand<'GenerationRequestId'>

export const GenerationRequestIdSchema = Schema.String.pipe(
  uuid(),
  Schema.brand('GenerationRequestId'),
  Schema.annotations({
    title: 'Generation Request ID',
    description: 'Unique identifier for a generation request',
  })
)

// === ノイズ生成型 ===

/** ノイズ値 - 正規化されたノイズ値 (-1.0 ~ 1.0) */
export type NoiseValue = number & Brand.Brand<'NoiseValue'>

export const NoiseValueSchema = Schema.Number.pipe(
  Schema.between(GENERATION_CONSTANTS.NOISE.RANGE.MIN, GENERATION_CONSTANTS.NOISE.RANGE.MAX),
  Schema.brand('NoiseValue'),
  Schema.annotations({
    title: 'Noise Value',
    description: 'Normalized noise value between -1.0 and 1.0',
  })
)

/** 正規化ノイズ値 - 0.0 ~ 1.0 の範囲に正規化 */
export type NormalizedNoiseValue = number & Brand.Brand<'NormalizedNoiseValue'>

export const NormalizedNoiseValueSchema = Schema.Number.pipe(
  Schema.between(GENERATION_CONSTANTS.NOISE.RANGE.NORMALIZED_MIN, GENERATION_CONSTANTS.NOISE.RANGE.NORMALIZED_MAX),
  Schema.brand('NormalizedNoiseValue'),
  Schema.annotations({
    title: 'Normalized Noise Value',
    description: 'Noise value normalized to 0.0-1.0 range',
  })
)

/** ノイズ座標 - ノイズ空間での座標 */
export type NoiseCoordinate = number & Brand.Brand<'NoiseCoordinate'>

export const NoiseCoordinateSchema = Schema.Number.pipe(
  Schema.brand('NoiseCoordinate'),
  Schema.annotations({
    title: 'Noise Coordinate',
    description: 'Coordinate in noise space',
  })
)

/** ノイズパラメータ */
export interface NoiseParameters {
  readonly octaves: number
  readonly amplitude: number
  readonly frequency: number
  readonly persistence: number
  readonly lacunarity: number
  readonly scale: number
}

export const NoiseParametersSchema = Schema.Struct({
  octaves: Schema.Number.pipe(
    Schema.int(),
    Schema.between(GENERATION_CONSTANTS.NOISE.PERLIN.MIN_OCTAVES, GENERATION_CONSTANTS.NOISE.PERLIN.MAX_OCTAVES)
  ),
  amplitude: Schema.Number.pipe(Schema.positive()),
  frequency: Schema.Number.pipe(Schema.positive()),
  persistence: Schema.Number.pipe(Schema.between(0, 1)),
  lacunarity: Schema.Number.pipe(Schema.between(1, 10)),
  scale: Schema.Number.pipe(Schema.positive()),
}).pipe(
  Schema.annotations({
    title: 'Noise Parameters',
    description: 'Configuration parameters for noise generation',
  })
)

// === 高度マップ型 ===

/** 高度マップ値 */
export type HeightMapValue = number & Brand.Brand<'HeightMapValue'>

export const HeightMapValueSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 256),
  Schema.brand('HeightMapValue'),
  Schema.annotations({
    title: 'Height Map Value',
    description: 'Height value in a height map',
  })
)

/** 高度マップ - チャンク内の各ブロックの高度情報 */
export interface HeightMap {
  readonly chunkPosition: ChunkPosition
  readonly heights: readonly HeightMapValue[][]
  readonly averageHeight: HeightMapValue
  readonly minHeight: HeightMapValue
  readonly maxHeight: HeightMapValue
}

export const HeightMapSchema = Schema.Struct({
  chunkPosition: Schema.suspend(() => import('./index').then((m) => m.ChunkPositionSchema)),
  heights: Schema.Array(Schema.Array(HeightMapValueSchema)),
  averageHeight: HeightMapValueSchema,
  minHeight: HeightMapValueSchema,
  maxHeight: HeightMapValueSchema,
}).pipe(
  Schema.annotations({
    title: 'Height Map',
    description: 'Height information for a chunk area',
  })
)

// === 生成段階型 ===

/** 生成段階 */
export type GenerationStage =
  | 'terrain_shape'
  | 'biome_assignment'
  | 'height_map'
  | 'surface_generation'
  | 'cave_generation'
  | 'ore_generation'
  | 'structure_generation'
  | 'decoration'
  | 'post_processing'

export const GenerationStageSchema = Schema.Literal(
  'terrain_shape',
  'biome_assignment',
  'height_map',
  'surface_generation',
  'cave_generation',
  'ore_generation',
  'structure_generation',
  'decoration',
  'post_processing'
).pipe(
  Schema.annotations({
    title: 'Generation Stage',
    description: 'Stage in the world generation pipeline',
  })
)

/** 生成段階の状態 */
export type GenerationStageStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export const GenerationStageStatusSchema = Schema.Literal('pending', 'in_progress', 'completed', 'failed').pipe(
  Schema.annotations({
    title: 'Generation Stage Status',
    description: 'Status of a generation stage',
  })
)

/** 生成段階の進捗情報 */
export interface GenerationStageProgress {
  readonly stage: GenerationStage
  readonly status: GenerationStageStatus
  readonly progress: number // 0.0 - 1.0
  readonly startTime: Date
  readonly endTime?: Date
  readonly error?: string
}

export const GenerationStageProgressSchema = Schema.Struct({
  stage: GenerationStageSchema,
  status: GenerationStageStatusSchema,
  progress: Schema.Number.pipe(Schema.between(0, 1)),
  startTime: Schema.DateFromSelf,
  endTime: Schema.optional(Schema.DateFromSelf),
  error: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Generation Stage Progress',
    description: 'Progress information for a generation stage',
  })
)

// === 生成設定型 ===

/** 生成設定 */
export interface GenerationSettings {
  readonly seed: WorldSeed
  readonly generateStructures: boolean
  readonly generateCaves: boolean
  readonly generateOres: boolean
  readonly generateDecorations: boolean
  readonly biomeBlending: boolean
  readonly amplified: boolean
  readonly seaLevel: number
  readonly bedrockLevel: number
}

export const GenerationSettingsSchema = Schema.Struct({
  seed: Schema.suspend(() => import('./index').then((m) => m.WorldSeedSchema)),
  generateStructures: Schema.Boolean,
  generateCaves: Schema.Boolean,
  generateOres: Schema.Boolean,
  generateDecorations: Schema.Boolean,
  biomeBlending: Schema.Boolean,
  amplified: Schema.Boolean,
  seaLevel: Schema.Number.pipe(Schema.int(), Schema.between(0, 256)),
  bedrockLevel: Schema.Number.pipe(Schema.int(), Schema.between(0, 10)),
}).pipe(
  Schema.annotations({
    title: 'Generation Settings',
    description: 'Settings that control world generation behavior',
  })
)

// === 生成結果型 ===

/** チャンク生成結果 */
export interface ChunkGenerationResult {
  readonly requestId: GenerationRequestId
  readonly chunkPosition: ChunkPosition
  readonly stages: readonly GenerationStageProgress[]
  readonly heightMap: HeightMap
  readonly biomeData: BiomeGenerationData
  readonly generationTime: number // milliseconds
  readonly memoryUsage: number // bytes
  readonly success: boolean
  readonly errors: readonly string[]
}

export const ChunkGenerationResultSchema = Schema.Struct({
  requestId: GenerationRequestIdSchema,
  chunkPosition: Schema.suspend(() => import('./index').then((m) => m.ChunkPositionSchema)),
  stages: Schema.Array(GenerationStageProgressSchema),
  heightMap: HeightMapSchema,
  biomeData: BiomeGenerationDataSchema,
  generationTime: Schema.Number.pipe(Schema.nonNegative()),
  memoryUsage: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  success: Schema.Boolean,
  errors: Schema.Array(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Chunk Generation Result',
    description: 'Result of chunk generation process',
  })
)

// === バイオーム生成型 ===

/** バイオーム生成データ */
export interface BiomeGenerationData {
  readonly primaryBiome: string
  readonly biomeMap: readonly string[][]
  readonly temperatureMap: readonly number[][]
  readonly humidityMap: readonly number[][]
  readonly continentalnessMap: readonly number[][]
  readonly erosionMap: readonly number[][]
  readonly depthMap: readonly number[][]
  readonly weirdnessMap: readonly number[][]
}

export const BiomeGenerationDataSchema = Schema.Struct({
  primaryBiome: Schema.String,
  biomeMap: Schema.Array(Schema.Array(Schema.String)),
  temperatureMap: Schema.Array(Schema.Array(Schema.Number)),
  humidityMap: Schema.Array(Schema.Array(Schema.Number)),
  continentalnessMap: Schema.Array(Schema.Array(Schema.Number)),
  erosionMap: Schema.Array(Schema.Array(Schema.Number)),
  depthMap: Schema.Array(Schema.Array(Schema.Number)),
  weirdnessMap: Schema.Array(Schema.Array(Schema.Number)),
}).pipe(
  Schema.annotations({
    title: 'Biome Generation Data',
    description: 'Biome and climate data for a chunk',
  })
)

// === 構造物生成型 ===

/** 構造物タイプ */
export type StructureType =
  | 'village'
  | 'dungeon'
  | 'mineshaft'
  | 'stronghold'
  | 'temple'
  | 'monument'
  | 'mansion'
  | 'outpost'
  | 'ruined_portal'
  | 'shipwreck'

export const StructureTypeSchema = Schema.Literal(
  'village',
  'dungeon',
  'mineshaft',
  'stronghold',
  'temple',
  'monument',
  'mansion',
  'outpost',
  'ruined_portal',
  'shipwreck'
).pipe(
  Schema.annotations({
    title: 'Structure Type',
    description: 'Type of generated structure',
  })
)

/** 構造物生成情報 */
export interface StructureInfo {
  readonly type: StructureType
  readonly position: Vector3D
  readonly rotation: number
  readonly boundingBox: BoundingBox
  readonly variant?: string
  readonly seed: number
}

export const StructureInfoSchema = Schema.Struct({
  type: StructureTypeSchema,
  position: Schema.suspend(() => import('./index').then((m) => m.Vector3DSchema)),
  rotation: Schema.Number.pipe(Schema.between(0, 360)),
  boundingBox: BoundingBoxSchema,
  variant: Schema.optional(Schema.String),
  seed: Schema.Number.pipe(Schema.int()),
}).pipe(
  Schema.annotations({
    title: 'Structure Info',
    description: 'Information about a generated structure',
  })
)

/** バウンディングボックス */
export interface BoundingBox {
  readonly min: Vector3D
  readonly max: Vector3D
}

export const BoundingBoxSchema = Schema.Struct({
  min: Schema.suspend(() => import('./index').then((m) => m.Vector3DSchema)),
  max: Schema.suspend(() => import('./index').then((m) => m.Vector3DSchema)),
}).pipe(
  Schema.annotations({
    title: 'Bounding Box',
    description: '3D bounding box defined by min and max points',
  })
)

// === 生成パフォーマンス型 ===

/** 生成パフォーマンス統計 */
export interface GenerationPerformanceStats {
  readonly totalChunksGenerated: number
  readonly averageGenerationTime: number // milliseconds
  readonly totalGenerationTime: number // milliseconds
  readonly peakMemoryUsage: number // bytes
  readonly averageMemoryUsage: number // bytes
  readonly cacheHitRate: number // 0.0 - 1.0
  readonly parallelThreadsUsed: number
  readonly errorRate: number // 0.0 - 1.0
}

export const GenerationPerformanceStatsSchema = Schema.Struct({
  totalChunksGenerated: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  averageGenerationTime: Schema.Number.pipe(Schema.nonNegative()),
  totalGenerationTime: Schema.Number.pipe(Schema.nonNegative()),
  peakMemoryUsage: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  averageMemoryUsage: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  cacheHitRate: Schema.Number.pipe(Schema.between(0, 1)),
  parallelThreadsUsed: Schema.Number.pipe(Schema.int(), Schema.between(1, 16)),
  errorRate: Schema.Number.pipe(Schema.between(0, 1)),
}).pipe(
  Schema.annotations({
    title: 'Generation Performance Stats',
    description: 'Performance statistics for world generation',
  })
)

// === 生成コンテキスト型 ===

/** 生成コンテキスト - 生成処理で共有される情報 */
export interface GenerationContext {
  readonly sessionId: GenerationSessionId
  readonly settings: GenerationSettings
  readonly seed: WorldSeed
  readonly noiseParams: NoiseParameters
  readonly performanceStats: GenerationPerformanceStats
  readonly activeRequests: readonly GenerationRequestId[]
  readonly completedChunks: readonly ChunkPosition[]
}

export const GenerationContextSchema = Schema.Struct({
  sessionId: GenerationSessionIdSchema,
  settings: GenerationSettingsSchema,
  seed: Schema.suspend(() => import('./index').then((m) => m.WorldSeedSchema)),
  noiseParams: NoiseParametersSchema,
  performanceStats: GenerationPerformanceStatsSchema,
  activeRequests: Schema.Array(GenerationRequestIdSchema),
  completedChunks: Schema.Array(Schema.suspend(() => import('./index').then((m) => m.ChunkPositionSchema))),
}).pipe(
  Schema.annotations({
    title: 'Generation Context',
    description: 'Shared context for world generation operations',
  })
)

// === 作成ヘルパー関数 ===

/** NoiseValue作成ヘルパー */
export const createNoiseValue = (value: number): NoiseValue => Schema.decodeSync(NoiseValueSchema)(value)

/** NormalizedNoiseValue作成ヘルパー */
export const createNormalizedNoiseValue = (value: number): NormalizedNoiseValue =>
  Schema.decodeSync(NormalizedNoiseValueSchema)(value)

/** HeightMapValue作成ヘルパー */
export const createHeightMapValue = (value: number): HeightMapValue => Schema.decodeSync(HeightMapValueSchema)(value)

/** GenerationSessionId作成ヘルパー */
export const createGenerationSessionId = (): GenerationSessionId =>
  Schema.decodeSync(GenerationSessionIdSchema)(crypto.randomUUID())

/** GenerationRequestId作成ヘルパー */
export const createGenerationRequestId = (): GenerationRequestId =>
  Schema.decodeSync(GenerationRequestIdSchema)(crypto.randomUUID())
