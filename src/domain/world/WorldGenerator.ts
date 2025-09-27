/**
 * ワールドジェネレータインターフェースの定義
 *
 * @module domain/world/WorldGenerator
 */

import { Effect, Context, Predicate } from 'effect'
import { Schema } from '@effect/schema'
import type { Chunk, ChunkData } from '../chunk/index'
import type { ChunkPosition } from '../chunk/ChunkPosition'
import type { BiomeInfo, BiomeType, Structure, Vector3 } from './types'
import type { GeneratorOptions, StructureType } from './GeneratorOptions'

/**
 * ワールド生成エラーの定義
 */
export interface GenerationError {
  readonly _tag: 'GenerationError'
  readonly position?: { x: number; y?: number; z: number }
  readonly reason: string
  readonly context?: string
}

export const GenerationError = (
  reason: string,
  position?: { x: number; y?: number; z: number },
  context?: string
): GenerationError => ({
  _tag: 'GenerationError',
  reason,
  ...(position !== undefined && { position }),
  ...(context !== undefined && { context }),
})

export const isGenerationError = (error: unknown): error is GenerationError =>
  Predicate.isRecord(error) && '_tag' in error && error['_tag'] === 'GenerationError'

/**
 * 構造物生成エラー
 */
export interface StructureGenerationError {
  readonly _tag: 'StructureGenerationError'
  readonly structureType: string
  readonly position: { x: number; y: number; z: number }
  readonly reason: string
}

export const StructureGenerationError = (
  structureType: string,
  position: { x: number; y: number; z: number },
  reason: string
): StructureGenerationError => ({
  _tag: 'StructureGenerationError',
  structureType,
  position,
  reason,
})

export const isStructureGenerationError = (error: unknown): error is StructureGenerationError =>
  Predicate.isRecord(error) && '_tag' in error && error['_tag'] === 'StructureGenerationError'

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
  readonly generateChunk: (position: ChunkPosition) => Effect.Effect<ChunkGenerationResult, GenerationError, never>

  /**
   * 構造物を生成
   */
  readonly generateStructure: (
    type: StructureType,
    position: Vector3
  ) => Effect.Effect<Structure, StructureGenerationError, never>

  /**
   * スポーン地点を取得
   */
  readonly getSpawnPoint: () => Effect.Effect<Vector3, never, never>

  /**
   * 指定座標のバイオームを取得
   */
  readonly getBiome: (position: Vector3) => Effect.Effect<BiomeInfo, never, never>

  /**
   * 指定座標の地形高さを取得
   */
  readonly getTerrainHeight: (x: number, z: number) => Effect.Effect<number, never, never>

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
  readonly canGenerateStructure: (type: StructureType, position: Vector3) => Effect.Effect<boolean, never, never>

  /**
   * 近くの構造物を検索
   */
  readonly findNearestStructure: (
    type: StructureType,
    position: Vector3,
    searchRadius: number
  ) => Effect.Effect<Structure | null, GenerationError, never>
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

/**
 * WorldGenerator Context Tag
 */
export const WorldGeneratorTag = Context.GenericTag<WorldGenerator>('@minecraft/domain/WorldGenerator')
