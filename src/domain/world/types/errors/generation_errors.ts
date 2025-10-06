/**
 * @fileoverview Generation Domain Errors
 * 世界生成システムの構造化エラー定義
 */

import { Clock, Data, Effect, Schema } from 'effect'
import { ChunkPosition, GenerationRequestId, GenerationSessionId, GenerationStage, NoiseParameters } from '../core'
import { ErrorContext } from './index'

// === 生成プロセスエラー ===

/** チャンク生成失敗エラー */
export class ChunkGenerationError extends Data.TaggedError('ChunkGenerationError')<{
  readonly requestId: GenerationRequestId
  readonly chunkPosition: ChunkPosition
  readonly stage: GenerationStage
  readonly reason: string
  readonly context: ErrorContext
  readonly retryable: boolean
  readonly partialResult?: boolean
}> {
  get message() {
    return `Chunk generation failed at ${this.chunkPosition.x},${this.chunkPosition.z} during ${this.stage}: ${this.reason}`
  }
}

export const ChunkGenerationErrorSchema = Schema.TaggedStruct('ChunkGenerationError', {
  requestId: Schema.suspend(() => import('../core').then((m) => m.GenerationRequestIdSchema)),
  chunkPosition: Schema.suspend(() => import('../core').then((m) => m.ChunkPositionSchema)),
  stage: Schema.suspend(() => import('../core').then((m) => m.GenerationStageSchema)),
  reason: Schema.String,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  retryable: Schema.Boolean,
  partialResult: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    title: 'Chunk Generation Error',
    description: 'Error during chunk generation process',
  })
)

/** 生成セッション失敗エラー */
export class GenerationSessionError extends Data.TaggedError('GenerationSessionError')<{
  readonly sessionId: GenerationSessionId
  readonly activeRequests: readonly GenerationRequestId[]
  readonly reason: string
  readonly context: ErrorContext
  readonly recovery: 'restart' | 'continue' | 'abort'
}> {
  get message() {
    return `Generation session ${this.sessionId} failed: ${this.reason} (${this.activeRequests.length} active requests)`
  }
}

export const GenerationSessionErrorSchema = Schema.TaggedStruct('GenerationSessionError', {
  sessionId: Schema.suspend(() => import('../core').then((m) => m.GenerationSessionIdSchema)),
  activeRequests: Schema.Array(Schema.suspend(() => import('../core').then((m) => m.GenerationRequestIdSchema))),
  reason: Schema.String,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  recovery: Schema.Literal('restart', 'continue', 'abort'),
}).pipe(
  Schema.annotations({
    title: 'Generation Session Error',
    description: 'Error in generation session management',
  })
)

/** 生成タイムアウトエラー */
export class GenerationTimeoutError extends Data.TaggedError('GenerationTimeoutError')<{
  readonly requestId: GenerationRequestId
  readonly chunkPosition: ChunkPosition
  readonly stage: GenerationStage
  readonly timeoutMs: number
  readonly elapsedMs: number
  readonly context: ErrorContext
  readonly canRetry: boolean
}> {
  get message() {
    return `Generation timeout for chunk ${this.chunkPosition.x},${this.chunkPosition.z} at stage ${this.stage} after ${this.elapsedMs}ms`
  }
}

export const GenerationTimeoutErrorSchema = Schema.TaggedStruct('GenerationTimeoutError', {
  requestId: Schema.suspend(() => import('../core').then((m) => m.GenerationRequestIdSchema)),
  chunkPosition: Schema.suspend(() => import('../core').then((m) => m.ChunkPositionSchema)),
  stage: Schema.suspend(() => import('../core').then((m) => m.GenerationStageSchema)),
  timeoutMs: Schema.Number.pipe(Schema.int(), Schema.positive()),
  elapsedMs: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  canRetry: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'Generation Timeout Error',
    description: 'Error when generation process times out',
  })
)

// === ノイズ生成エラー ===

/** 無効なノイズパラメータエラー */
export class InvalidNoiseParametersError extends Data.TaggedError('InvalidNoiseParametersError')<{
  readonly parameters: NoiseParameters
  readonly invalidFields: readonly string[]
  readonly reason: string
  readonly context: ErrorContext
  readonly suggestedFix?: NoiseParameters
}> {
  get message() {
    return `Invalid noise parameters: ${this.invalidFields.join(', ')} - ${this.reason}`
  }
}

export const InvalidNoiseParametersErrorSchema = Schema.TaggedStruct('InvalidNoiseParametersError', {
  parameters: Schema.suspend(() => import('../core').then((m) => m.NoiseParametersSchema)),
  invalidFields: Schema.Array(Schema.String),
  reason: Schema.String,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  suggestedFix: Schema.optional(Schema.suspend(() => import('../core').then((m) => m.NoiseParametersSchema))),
}).pipe(
  Schema.annotations({
    title: 'Invalid Noise Parameters Error',
    description: 'Error when noise generation parameters are invalid',
  })
)

/** ノイズ生成失敗エラー */
export class NoiseGenerationError extends Data.TaggedError('NoiseGenerationError')<{
  readonly noiseType: 'perlin' | 'simplex' | 'ridged' | 'cellular'
  readonly coordinates: { x: number; y?: number; z: number }
  readonly parameters: NoiseParameters
  readonly reason: string
  readonly context: ErrorContext
}> {
  get message() {
    return `${this.noiseType} noise generation failed at (${this.coordinates.x}, ${this.coordinates.z}): ${this.reason}`
  }
}

export const NoiseGenerationErrorSchema = Schema.TaggedStruct('NoiseGenerationError', {
  noiseType: Schema.Literal('perlin', 'simplex', 'ridged', 'cellular'),
  coordinates: Schema.Struct({
    x: Schema.Number,
    y: Schema.optional(Schema.Number),
    z: Schema.Number,
  }),
  parameters: Schema.suspend(() => import('../core').then((m) => m.NoiseParametersSchema)),
  reason: Schema.String,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
}).pipe(
  Schema.annotations({
    title: 'Noise Generation Error',
    description: 'Error during noise value generation',
  })
)

// === 地形生成エラー ===

/** 高度マップ生成失敗エラー */
export class HeightMapGenerationError extends Data.TaggedError('HeightMapGenerationError')<{
  readonly chunkPosition: ChunkPosition
  readonly reason: string
  readonly context: ErrorContext
  readonly affectedArea: { minX: number; maxX: number; minZ: number; maxZ: number }
}> {
  get message() {
    return `Height map generation failed for chunk ${this.chunkPosition.x},${this.chunkPosition.z}: ${this.reason}`
  }
}

export const HeightMapGenerationErrorSchema = Schema.TaggedStruct('HeightMapGenerationError', {
  chunkPosition: Schema.suspend(() => import('../core').then((m) => m.ChunkPositionSchema)),
  reason: Schema.String,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  affectedArea: Schema.Struct({
    minX: Schema.Number.pipe(Schema.int()),
    maxX: Schema.Number.pipe(Schema.int()),
    minZ: Schema.Number.pipe(Schema.int()),
    maxZ: Schema.Number.pipe(Schema.int()),
  }),
}).pipe(
  Schema.annotations({
    title: 'Height Map Generation Error',
    description: 'Error during height map generation',
  })
)

/** 地形形成失敗エラー */
export class TerrainShapeError extends Data.TaggedError('TerrainShapeError')<{
  readonly chunkPosition: ChunkPosition
  readonly stage: 'surface' | 'underground' | 'bedrock' | 'caves'
  readonly reason: string
  readonly context: ErrorContext
  readonly corruptedBlocks: readonly { x: number; y: number; z: number }[]
}> {
  get message() {
    return `Terrain shaping failed at chunk ${this.chunkPosition.x},${this.chunkPosition.z} during ${this.stage}: ${this.reason}`
  }
}

export const TerrainShapeErrorSchema = Schema.TaggedStruct('TerrainShapeError', {
  chunkPosition: Schema.suspend(() => import('../core').then((m) => m.ChunkPositionSchema)),
  stage: Schema.Literal('surface', 'underground', 'bedrock', 'caves'),
  reason: Schema.String,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  corruptedBlocks: Schema.Array(
    Schema.Struct({
      x: Schema.Number.pipe(Schema.int()),
      y: Schema.Number.pipe(Schema.int()),
      z: Schema.Number.pipe(Schema.int()),
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Terrain Shape Error',
    description: 'Error during terrain shaping process',
  })
)

// === バイオーム生成エラー ===

/** バイオーム割り当て失敗エラー */
export class BiomeAssignmentError extends Data.TaggedError('BiomeAssignmentError')<{
  readonly chunkPosition: ChunkPosition
  readonly climateData: { temperature: number; humidity: number }
  readonly reason: string
  readonly context: ErrorContext
  readonly fallbackBiome?: string
}> {
  get message() {
    return `Biome assignment failed for chunk ${this.chunkPosition.x},${this.chunkPosition.z}: ${this.reason}`
  }
}

export const BiomeAssignmentErrorSchema = Schema.TaggedStruct('BiomeAssignmentError', {
  chunkPosition: Schema.suspend(() => import('../core').then((m) => m.ChunkPositionSchema)),
  climateData: Schema.Struct({
    temperature: Schema.Number,
    humidity: Schema.Number,
  }),
  reason: Schema.String,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  fallbackBiome: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Biome Assignment Error',
    description: 'Error when assigning biomes to terrain',
  })
)

/** 気候データ計算失敗エラー */
export class ClimateDataError extends Data.TaggedError('ClimateDataError')<{
  readonly coordinates: { x: number; z: number }
  readonly parameter: 'temperature' | 'humidity' | 'continentalness' | 'erosion' | 'depth' | 'weirdness'
  readonly reason: string
  readonly context: ErrorContext
  readonly fallbackValue?: number
}> {
  get message() {
    return `Climate data calculation failed for ${this.parameter} at (${this.coordinates.x}, ${this.coordinates.z}): ${this.reason}`
  }
}

export const ClimateDataErrorSchema = Schema.TaggedStruct('ClimateDataError', {
  coordinates: Schema.Struct({
    x: Schema.Number,
    z: Schema.Number,
  }),
  parameter: Schema.Literal('temperature', 'humidity', 'continentalness', 'erosion', 'depth', 'weirdness'),
  reason: Schema.String,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  fallbackValue: Schema.optional(Schema.Number),
}).pipe(
  Schema.annotations({
    title: 'Climate Data Error',
    description: 'Error during climate parameter calculation',
  })
)

// === 構造物生成エラー ===

/** 構造物配置失敗エラー */
export class StructurePlacementError extends Data.TaggedError('StructurePlacementError')<{
  readonly structureType: string
  readonly position: { x: number; y: number; z: number }
  readonly reason: string
  readonly context: ErrorContext
  readonly conflicts: readonly string[]
}> {
  get message() {
    return `Failed to place ${this.structureType} at (${this.position.x}, ${this.position.y}, ${this.position.z}): ${this.reason}`
  }
}

export const StructurePlacementErrorSchema = Schema.TaggedStruct('StructurePlacementError', {
  structureType: Schema.String,
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.int()),
    y: Schema.Number.pipe(Schema.int()),
    z: Schema.Number.pipe(Schema.int()),
  }),
  reason: Schema.String,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  conflicts: Schema.Array(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Structure Placement Error',
    description: 'Error when placing generated structures',
  })
)

// === 依存関係エラー ===

/** 生成依存関係エラー */
export class GenerationDependencyError extends Data.TaggedError('GenerationDependencyError')<{
  readonly requiredStage: GenerationStage
  readonly currentStage: GenerationStage
  readonly chunkPosition: ChunkPosition
  readonly context: ErrorContext
  readonly canSkip: boolean
}> {
  get message() {
    return `Generation dependency error: ${this.requiredStage} required before ${this.currentStage} for chunk ${this.chunkPosition.x},${this.chunkPosition.z}`
  }
}

export const GenerationDependencyErrorSchema = Schema.TaggedStruct('GenerationDependencyError', {
  requiredStage: Schema.suspend(() => import('../core').then((m) => m.GenerationStageSchema)),
  currentStage: Schema.suspend(() => import('../core').then((m) => m.GenerationStageSchema)),
  chunkPosition: Schema.suspend(() => import('../core').then((m) => m.ChunkPositionSchema)),
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  canSkip: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'Generation Dependency Error',
    description: 'Error when generation stage dependencies are not met',
  })
)

// === 汎用生成エラー ===

/** 汎用生成エラー型 */
export class GenerationError extends Data.TaggedError('GenerationError')<{
  readonly type: 'NoiseError' | 'BiomeError' | 'MathematicalError' | 'ValidationError' | 'StatisticalError'
  readonly message: string
  readonly context?: ErrorContext
}> {
  get message() {
    return `${this.type}: ${this.message}`
  }
}

export const GenerationErrorSchema = Schema.TaggedStruct('GenerationError', {
  type: Schema.Literal('NoiseError', 'BiomeError', 'MathematicalError', 'ValidationError', 'StatisticalError'),
  message: Schema.String,
  context: Schema.optional(Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema))),
}).pipe(
  Schema.annotations({
    title: 'Generation Error',
    description: 'General purpose generation error for domain services',
  })
)

// === 生成エラー統合型 ===

/** 生成ドメインの全エラー型 */
export type GenerationDomainError =
  | ChunkGenerationError
  | GenerationSessionError
  | GenerationTimeoutError
  | InvalidNoiseParametersError
  | NoiseGenerationError
  | HeightMapGenerationError
  | TerrainShapeError
  | BiomeAssignmentError
  | ClimateDataError
  | StructurePlacementError
  | GenerationDependencyError
  | GenerationError

export const GenerationDomainErrorSchema = Schema.Union(
  ChunkGenerationErrorSchema,
  GenerationSessionErrorSchema,
  GenerationTimeoutErrorSchema,
  InvalidNoiseParametersErrorSchema,
  NoiseGenerationErrorSchema,
  HeightMapGenerationErrorSchema,
  TerrainShapeErrorSchema,
  BiomeAssignmentErrorSchema,
  ClimateDataErrorSchema,
  StructurePlacementErrorSchema,
  GenerationDependencyErrorSchema,
  GenerationErrorSchema
).pipe(
  Schema.annotations({
    title: 'Generation Domain Error',
    description: 'Union of all generation domain errors',
  })
)

// === エラー作成ヘルパー関数 ===

/** ChunkGenerationError作成ヘルパー */
export const createChunkGenerationError = (
  requestId: GenerationRequestId,
  chunkPosition: ChunkPosition,
  stage: GenerationStage,
  reason: string,
  context?: Partial<ErrorContext>,
  retryable: boolean = true
): Effect.Effect<ChunkGenerationError> =>
  Effect.gen(function* () {
    const timestamp = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))
    return new ChunkGenerationError({
      requestId,
      chunkPosition,
      stage,
      reason,
      context: { timestamp, ...context },
      retryable,
    })
  })

/** NoiseGenerationError作成ヘルパー */
export const createNoiseGenerationError = (
  noiseType: 'perlin' | 'simplex' | 'ridged' | 'cellular',
  coordinates: { x: number; y?: number; z: number },
  parameters: NoiseParameters,
  reason: string,
  context?: Partial<ErrorContext>
): Effect.Effect<NoiseGenerationError> =>
  Effect.gen(function* () {
    const timestamp = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))
    return new NoiseGenerationError({
      noiseType,
      coordinates,
      parameters,
      reason,
      context: { timestamp, ...context },
    })
  })

/** BiomeAssignmentError作成ヘルパー */
export const createBiomeAssignmentError = (
  chunkPosition: ChunkPosition,
  climateData: { temperature: number; humidity: number },
  reason: string,
  context?: Partial<ErrorContext>,
  fallbackBiome?: string
): Effect.Effect<BiomeAssignmentError> =>
  Effect.gen(function* () {
    const timestamp = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))
    return new BiomeAssignmentError({
      chunkPosition,
      climateData,
      reason,
      context: { timestamp, ...context },
      fallbackBiome,
    })
  })
