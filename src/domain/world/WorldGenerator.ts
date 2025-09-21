/**
 * ワールドジェネレータインターフェースの定義
 *
 * @module domain/world/WorldGenerator
 */

import { Effect } from 'effect'
import { Schema } from '@effect/schema'
import type { Chunk, ChunkData } from '../chunk/index.js'
import type { ChunkPosition } from '../chunk/ChunkPosition.js'
import type { BiomeInfo, BiomeType, Structure, Vector3 } from './types.js'
import type { GeneratorOptions, StructureType } from './GeneratorOptions.js'

/**
 * ワールド生成エラーの定義
 */
export class GenerationError extends Schema.TaggedError<GenerationError>()('GenerationError', {
  position: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.optional(Schema.Number),
      z: Schema.Number,
    })
  ),
  reason: Schema.String,
  context: Schema.optional(Schema.String),
}) {}

/**
 * 構造物生成エラー
 */
export class StructureGenerationError extends Schema.TaggedError<StructureGenerationError>()(
  'StructureGenerationError',
  {
    structureType: Schema.String,
    position: Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    }),
    reason: Schema.String,
  }
) {}

/**
 * チャンク生成結果
 */
export interface ChunkGenerationResult {
  readonly chunk: ChunkData
  readonly biomes: readonly BiomeType[]
  readonly structures: readonly Structure[]
  readonly heightMap: readonly number[]
}

/**
 * ワールドジェネレータインターフェース
 */
export interface WorldGenerator {
  /**
   * チャンクを生成
   */
  readonly generateChunk: (position: ChunkPosition) => Effect.Effect<ChunkGenerationResult, GenerationError>

  /**
   * 構造物を生成
   */
  readonly generateStructure: (
    type: StructureType,
    position: Vector3
  ) => Effect.Effect<Structure, StructureGenerationError>

  /**
   * スポーン地点を取得
   */
  readonly getSpawnPoint: () => Effect.Effect<Vector3, never>

  /**
   * 指定座標のバイオームを取得
   */
  readonly getBiome: (position: Vector3) => Effect.Effect<BiomeInfo, never>

  /**
   * 指定座標の地形高さを取得
   */
  readonly getTerrainHeight: (x: number, z: number) => Effect.Effect<number, never>

  /**
   * シード値を取得
   */
  readonly getSeed: () => number

  /**
   * ジェネレータオプションを取得
   */
  readonly getOptions: () => GeneratorOptions

  /**
   * 構造物の生成可能性をチェック
   */
  readonly canGenerateStructure: (type: StructureType, position: Vector3) => Effect.Effect<boolean, never>

  /**
   * 近くの構造物を検索
   */
  readonly findNearestStructure: (
    type: StructureType,
    position: Vector3,
    searchRadius: number
  ) => Effect.Effect<Structure | null, GenerationError>
}

/**
 * ワールドジェネレータの状態
 */
export interface GeneratorState {
  readonly seed: number
  readonly options: GeneratorOptions
  readonly generatedChunks: ReadonlyMap<string, ChunkData>
  readonly structures: readonly Structure[]
  readonly spawnPoint: Vector3
}

/**
 * ジェネレータメタデータ
 */
export const GeneratorMetadataSchema = Schema.Struct({
  version: Schema.String,
  seed: Schema.Number,
  worldType: Schema.String,
  createdAt: Schema.Number,
  lastModified: Schema.Number,
  totalChunks: Schema.Number,
  totalStructures: Schema.Number,
})
export type GeneratorMetadata = Schema.Schema.Type<typeof GeneratorMetadataSchema>
