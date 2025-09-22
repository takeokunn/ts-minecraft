/**
 * ワールド生成ドメインのエクスポート
 *
 * @module domain/world
 */

// 基本型定義
export type { BiomeInfo, BiomeType, Structure, Vector3 } from './types.js'
export { BiomeInfoSchema, BiomeType as BiomeTypeSchema, StructureSchema, Vector3Schema } from './types.js'

// ジェネレータオプション
export type { GenerationFeature, GeneratorOptions, StructureType, WorldType } from './GeneratorOptions.js'
export {
  createGeneratorOptions,
  defaultGenerationFeatures,
  defaultGeneratorOptions,
  GenerationFeatureSchema,
  GeneratorOptionsSchema,
  StructureType as StructureTypeSchema,
  WorldType as WorldTypeSchema,
} from './GeneratorOptions.js'

// ワールドジェネレータインターフェース
export type { ChunkGenerationResult, GeneratorMetadata, GeneratorState, WorldGenerator } from './WorldGenerator.js'
export {
  GenerationError,
  GeneratorMetadataSchema,
  StructureGenerationError,
  WorldGeneratorTag,
} from './WorldGenerator.js'

// ファクトリ関数
export { createWorldGenerator } from './createWorldGenerator.js'
