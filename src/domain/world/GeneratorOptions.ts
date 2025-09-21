/**
 * ワールド生成オプションの定義
 *
 * @module domain/world/GeneratorOptions
 */

import { Schema } from '@effect/schema'

/**
 * ワールドタイプの定義
 */
export const WorldType = Schema.Literal('default', 'flat', 'amplified', 'large_biomes', 'custom')
export type WorldType = Schema.Schema.Type<typeof WorldType>

/**
 * 構造物タイプの定義
 */
export const StructureType = Schema.Literal(
  'village',
  'mineshaft',
  'stronghold',
  'temple',
  'dungeon',
  'fortress',
  'monument',
  'mansion',
  'outpost',
  'portal'
)
export type StructureType = Schema.Schema.Type<typeof StructureType>

/**
 * 生成フィーチャーの設定
 */
export const GenerationFeatureSchema = Schema.Struct({
  caves: Schema.Boolean,
  ravines: Schema.Boolean,
  mineshafts: Schema.Boolean,
  villages: Schema.Boolean,
  strongholds: Schema.Boolean,
  temples: Schema.Boolean,
  dungeons: Schema.Boolean,
  lakes: Schema.Boolean,
  lavaLakes: Schema.Boolean,
})
export type GenerationFeature = Schema.Schema.Type<typeof GenerationFeatureSchema>

/**
 * ワールド生成オプション
 */
export const GeneratorOptionsSchema = Schema.Struct({
  seed: Schema.Number,
  worldType: WorldType,
  generateStructures: Schema.Boolean,
  bonusChest: Schema.Boolean,
  biomeSize: Schema.Number.pipe(Schema.between(1, 10)),
  seaLevel: Schema.Number.pipe(Schema.between(0, 255)),
  features: GenerationFeatureSchema,
  renderDistance: Schema.Number.pipe(Schema.between(2, 32)),
  simulationDistance: Schema.Number.pipe(Schema.between(2, 32)),
})
export type GeneratorOptions = Schema.Schema.Type<typeof GeneratorOptionsSchema>

/**
 * デフォルトのジェネレーションフィーチャー設定
 */
export const defaultGenerationFeatures: GenerationFeature = {
  caves: true,
  ravines: true,
  mineshafts: true,
  villages: true,
  strongholds: true,
  temples: true,
  dungeons: true,
  lakes: true,
  lavaLakes: true,
}

/**
 * デフォルトの生成オプション
 */
export const defaultGeneratorOptions: GeneratorOptions = {
  seed: Date.now(),
  worldType: 'default',
  generateStructures: true,
  bonusChest: false,
  biomeSize: 4,
  seaLevel: 63,
  features: defaultGenerationFeatures,
  renderDistance: 8,
  simulationDistance: 6,
}

/**
 * オプションの作成ヘルパー
 */
export const createGeneratorOptions = (options: Partial<GeneratorOptions> = {}): GeneratorOptions => ({
  ...defaultGeneratorOptions,
  ...options,
  features: {
    ...defaultGenerationFeatures,
    ...(options.features ?? {}),
  },
})
