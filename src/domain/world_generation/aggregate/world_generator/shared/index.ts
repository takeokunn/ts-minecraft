import * as BiomeProperties from '@/domain/biome/value_object/biome_properties/index'
import * as Coordinates from '@domain/biome/value_object/coordinates'
import * as GenerationParameters from '@domain/world/value_object/generation_parameters/index'
import * as NoiseConfiguration from '@domain/world/value_object/noise_configuration/index'
import { Brand, Schema } from 'effect'
import * as GenerationContext from '../generation_context'
import * as GenerationState from '../generation_state'

/**
 * WorldGeneratorのBrand型識別子
 */
export type WorldGeneratorId = string & Brand.Brand<'WorldGeneratorId'>

export const WorldGeneratorIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('WorldGeneratorId'),
  Schema.annotations({
    title: 'WorldGeneratorId',
    description: 'Unique identifier for WorldGenerator aggregate root',
    examples: ['wg_12345678-1234-5678-9abc-123456789abc'],
  })
)

export const createWorldGeneratorId = (value: string): WorldGeneratorId =>
  Schema.decodeSync(WorldGeneratorIdSchema)(value)

/**
 * 集約バージョン (楽観的ロック)
 */
export type AggregateVersion = number & Brand.Brand<'AggregateVersion'>

export const AggregateVersionSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand('AggregateVersion'),
  Schema.annotations({
    title: 'AggregateVersion',
    description: 'Version number for optimistic locking',
  })
)

export const GenerationContextSchema = GenerationContext.GenerationContextSchema

export type GenerationContext = GenerationContext.GenerationContext

/**
 * 設定更新コマンド
 */
export const UpdateSettingsCommandSchema = Schema.Struct({
  parameters: Schema.optional(GenerationParameters.GenerationParametersSchema),
  biomeConfig: Schema.optional(BiomeProperties.BiomeConfigurationSchema),
  noiseConfig: Schema.optional(NoiseConfiguration.NoiseConfigurationSchema),
})

export type UpdateSettingsCommand = typeof UpdateSettingsCommandSchema.Type

/**
 * チャンク生成コマンド
 */
export const GenerateChunkCommandSchema = Schema.Struct({
  coordinate: Coordinates.ChunkCoordinateSchema,
  priority: Schema.Number.pipe(Schema.between(1, 10)),
  options: Schema.optional(
    Schema.Struct({
      includeStructures: Schema.Boolean,
      includeCaves: Schema.Boolean,
      includeOres: Schema.Boolean,
    })
  ),
})

export type GenerateChunkCommand = typeof GenerateChunkCommandSchema.Type

/**
 * WorldGenerator アグリゲートスキーマ
 */
export const WorldGeneratorSchema = Schema.Struct({
  id: WorldGeneratorIdSchema,
  version: AggregateVersionSchema,
  context: GenerationContextSchema,
  state: GenerationState.GenerationStateSchema,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
})

export type WorldGenerator = typeof WorldGeneratorSchema.Type
