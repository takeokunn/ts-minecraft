/**
 * ワールド生成ドメインのエクスポート
 *
 * @module domain/world
 */

// 基本型定義
export { BiomeInfoSchema, BiomeType as BiomeTypeSchema, StructureSchema, Vector3Schema } from './types'
export type { BiomeInfo, BiomeType, Structure, Vector3 } from './types'

// ジェネレータオプション
export {
  GenerationFeatureSchema,
  GeneratorOptionsSchema,
  StructureType as StructureTypeSchema,
  WorldType as WorldTypeSchema,
  createGeneratorOptions,
  defaultGenerationFeatures,
  defaultGeneratorOptions,
} from './GeneratorOptions'
export type { GenerationFeature, GeneratorOptions, StructureType, WorldType } from './GeneratorOptions'

// ワールドジェネレータインターフェース
export { GenerationError, GeneratorMetadataSchema, StructureGenerationError, WorldGeneratorTag } from './WorldGenerator'
export type { ChunkGenerationResult, GeneratorMetadata, GeneratorState, WorldGenerator } from './WorldGenerator'

// ファクトリ関数
export { createWorldGenerator } from './createWorldGenerator'
