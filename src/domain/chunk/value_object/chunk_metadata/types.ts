import { Schema } from '@effect/schema'
import { Brand, Data } from 'effect'

/**
 * バイオームタイプの値オブジェクト
 */
export type BiomeType = string & Brand.Brand<'BiomeType'>
export const BiomeType = Brand.refined<BiomeType>(
  (value): value is BiomeType => value.length > 0,
  (value) => Brand.error(`空文字列は許可されていません: ${value}`)
)

/**
 * ライトレベルの値オブジェクト
 */
export type LightLevel = number & Brand.Brand<'LightLevel'>
export const LightLevel = Brand.refined<LightLevel>(
  (value): value is LightLevel => Number.isInteger(value) && value >= 0 && value <= 15,
  (value) => Brand.error(`0〜15 の整数が必要です: ${value}`)
)

/**
 * タイムスタンプの値オブジェクト
 */
export type Timestamp = number & Brand.Brand<'Timestamp'>
export const Timestamp = Brand.refined<Timestamp>(
  (value): value is Timestamp => Number.isFinite(value) && value >= 0,
  (value) => Brand.error(`非負の有限値が必要です: ${value}`)
)

/**
 * 高さ値の値オブジェクト
 */
export type HeightValue = number & Brand.Brand<'HeightValue'>
export const HeightValue = Brand.refined<HeightValue>(
  (value): value is HeightValue => Number.isInteger(value) && value >= -64 && value <= 319,
  (value) => Brand.error(`-64〜319 の整数が必要です: ${value}`)
)

const nonEmptyString = Schema.String.pipe(Schema.nonEmptyString())
const optionalStringArray = Schema.optional(Schema.Array(Schema.String))

/**
 * チャンクメタデータのスキーマ定義
 */
export const ChunkMetadataSchema = Schema.Struct({
  biome: nonEmptyString,
  lightLevel: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
  isModified: Schema.Boolean,
  lastUpdate: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  heightMap: Schema.Array(Schema.Number.pipe(Schema.int())),
  generationVersion: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  features: optionalStringArray,
  structureReferences: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Array(Schema.String),
    })
  ),
}).pipe(Schema.brand('ChunkMetadata'))

export type ChunkMetadata = Schema.Schema.Type<typeof ChunkMetadataSchema>

/**
 * チャンクメタデータエラー型（ADT）
 */
export interface ChunkMetadataError {
  readonly _tag: 'ChunkMetadataError'
  readonly message: string
  readonly field?: string
  readonly value?: unknown
}

export const ChunkMetadataError = Data.tagged<ChunkMetadataError>('ChunkMetadataError')

/**
 * バイオーム定義
 */
export const Biomes = {
  OCEAN: 'ocean',
  PLAINS: 'plains',
  DESERT: 'desert',
  MOUNTAINS: 'mountains',
  FOREST: 'forest',
  TAIGA: 'taiga',
  SWAMP: 'swamp',
  RIVER: 'river',
  NETHER: 'nether',
  END: 'the_end',
  FROZEN_OCEAN: 'frozen_ocean',
  FROZEN_RIVER: 'frozen_river',
  SNOWY_TUNDRA: 'snowy_tundra',
  MUSHROOM_FIELDS: 'mushroom_fields',
  BEACH: 'beach',
  JUNGLE: 'jungle',
  SAVANNA: 'savanna',
  BADLANDS: 'badlands',
} as const satisfies Record<string, BiomeType>

export type BiomeValue = (typeof Biomes)[keyof typeof Biomes]

/**
 * チャンク特徴の定義
 */
export const ChunkFeatures = {
  VILLAGE: 'village',
  DUNGEON: 'dungeon',
  MINE_SHAFT: 'mine_shaft',
  STRONGHOLD: 'stronghold',
  TEMPLE: 'temple',
  MONUMENT: 'monument',
  MANSION: 'mansion',
  OUTPOST: 'outpost',
  RUINED_PORTAL: 'ruined_portal',
  SHIPWRECK: 'shipwreck',
} as const satisfies Record<string, string>

export type ChunkFeatureValue = (typeof ChunkFeatures)[keyof typeof ChunkFeatures]
