import * as BiomeProperties from '@domain/world/biome/biome_properties.js'
import * as Schema from '@effect/schema/Schema'

/**
 * BiomeSystemBuilder状態スキーマ
 * 全フィールドはoptionalで初期状態は空オブジェクト
 */
export const BiomeSystemBuilderStateSchema = Schema.Struct({
  preset: Schema.optional(
    Schema.Literal('default', 'vanilla', 'diverse', 'extreme', 'custom', 'minimal', 'realistic', 'fantasy')
  ),
  climateConfig: Schema.optional(BiomeProperties.BiomeConfigurationSchema),
  enableTransitions: Schema.optional(Schema.Boolean),
  ecosystemComplexity: Schema.optional(Schema.Literal('simple', 'complex', 'realistic')),
  performanceProfile: Schema.optional(Schema.Literal('fast', 'balanced', 'quality')),
  validationLevel: Schema.optional(Schema.Literal('none', 'basic', 'standard', 'strict')),
  enableCaching: Schema.optional(Schema.Boolean),
  parallelProcessing: Schema.optional(Schema.Boolean),
  memoryLimit: Schema.optional(Schema.Number),
  customBiomes: Schema.optional(Schema.ReadonlyArray(BiomeProperties.BiomeTypeSchema)),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export type BiomeSystemBuilderState = Schema.Schema.Type<typeof BiomeSystemBuilderStateSchema>

export type BiomePresetType =
  | 'default'
  | 'vanilla'
  | 'diverse'
  | 'extreme'
  | 'custom'
  | 'minimal'
  | 'realistic'
  | 'fantasy'
export type PerformanceProfile = 'fast' | 'balanced' | 'quality'
export type ValidationLevel = 'none' | 'basic' | 'standard' | 'strict'

/**
 * 初期状態（空オブジェクト）
 */
export const initialBiomeSystemBuilderState: BiomeSystemBuilderState = {}
