/**
 * ワールド生成ドメインのエクスポート
 *
 * @module domain/world
 */

// 基本型定義
export type { BiomeInfo, BiomeType, Structure, Vector3 } from './types'
export { BiomeInfoSchema, BiomeType as BiomeTypeSchema, StructureSchema, Vector3Schema } from './types'

// ジェネレータオプション
export type { GenerationFeature, GeneratorOptions, StructureType, WorldType } from './GeneratorOptions'
export {
  createGeneratorOptions,
  defaultGenerationFeatures,
  defaultGeneratorOptions,
  GenerationFeatureSchema,
  GeneratorOptionsSchema,
  StructureType as StructureTypeSchema,
  WorldType as WorldTypeSchema,
} from './GeneratorOptions'

// ワールドジェネレータインターフェース
export type { ChunkGenerationResult, GeneratorMetadata, GeneratorState, WorldGenerator } from './WorldGenerator'
export { GenerationError, GeneratorMetadataSchema, StructureGenerationError, WorldGeneratorTag } from './WorldGenerator'

// ファクトリ関数
export { createWorldGenerator } from './createWorldGenerator'
