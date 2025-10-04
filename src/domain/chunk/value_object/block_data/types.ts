import { Schema } from '@effect/schema'
import { Brand, Data } from 'effect'

/**
 * ブロックIDの値オブジェクト
 */
export type BlockId = number & Brand.Brand<'BlockId'>
export const BlockId = Brand.refined<BlockId>(
  (value): value is BlockId => Number.isInteger(value) && value >= 0 && value <= 65535,
  (value) => Brand.error(`0〜65535 の整数が必要です: ${value}`)
)

/**
 * ブロックデータの値オブジェクト
 */
export type BlockData = number & Brand.Brand<'BlockData'>
export const BlockData = Brand.refined<BlockData>(
  (value): value is BlockData => Number.isInteger(value) && value >= 0 && value <= 15,
  (value) => Brand.error(`0〜15 の整数が必要です: ${value}`)
)

/**
 * ブロック状態の値オブジェクト
 */
export type BlockState = number & Brand.Brand<'BlockState'>
export const BlockState = Brand.refined<BlockState>(
  (value): value is BlockState => Number.isInteger(value) && value >= 0,
  (value) => Brand.error(`非負の整数が必要です: ${value}`)
)

/**
 * ブロックライトレベルの値オブジェクト
 */
export type BlockLightLevel = number & Brand.Brand<'BlockLightLevel'>
export const BlockLightLevel = Brand.refined<BlockLightLevel>(
  (value): value is BlockLightLevel => Number.isInteger(value) && value >= 0 && value <= 15,
  (value) => Brand.error(`0〜15 の整数が必要です: ${value}`)
)

/**
 * ブロックメタデータのスキーマ定義
 */
export const BlockMetadataSchema = Schema.Struct({
  hardness: Schema.Number.pipe(Schema.between(0, 100)),
  transparency: Schema.Boolean,
  luminance: Schema.Number.pipe(Schema.between(0, 15)),
  flammable: Schema.Boolean,
  solid: Schema.Boolean,
}).pipe(Schema.brand('BlockMetadata'))

export type BlockMetadata = Schema.Schema.Type<typeof BlockMetadataSchema>

/**
 * ブロック情報の完全なスキーマ定義
 */
export const BlockInfoSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.between(0, 65535)),
  data: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
  state: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  lightLevel: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
  metadata: BlockMetadataSchema,
}).pipe(Schema.brand('BlockInfo'))

export type BlockInfo = Schema.Schema.Type<typeof BlockInfoSchema>

/**
 * ブロックエラーADT
 */
export interface BlockDataError {
  readonly _tag: 'BlockDataError'
  readonly message: string
  readonly blockId?: BlockId
  readonly value?: unknown
}

export const BlockDataError = Data.tagged<BlockDataError>('BlockDataError')

export interface BlockDataCorruptionError {
  readonly _tag: 'BlockDataCorruptionError'
  readonly message: string
  readonly blockId: BlockId
  readonly expectedChecksum?: string
  readonly actualChecksum?: string
}

export const BlockDataCorruptionError = Data.tagged<BlockDataCorruptionError>('BlockDataCorruptionError')

/**
 * ブロックタイプの列挙型
 */
export const BlockType = {
  AIR: 0,
  STONE: 1,
  GRASS: 2,
  DIRT: 3,
  COBBLESTONE: 4,
  WOOD: 5,
  SAPLING: 6,
  BEDROCK: 7,
  WATER: 8,
  LAVA: 11,
  SAND: 12,
  GRAVEL: 13,
  GOLD_ORE: 14,
  IRON_ORE: 15,
  COAL_ORE: 16,
  LOG: 17,
  LEAVES: 18,
  GLASS: 20,
} as const satisfies Record<string, number>

export type BlockTypeValue = (typeof BlockType)[keyof typeof BlockType]

/**
 * ブロック分類の列挙型
 */
export const BlockCategory = {
  BUILDING: 'building',
  NATURAL: 'natural',
  DECORATIVE: 'decorative',
  REDSTONE: 'redstone',
  TRANSPORTATION: 'transportation',
  MISC: 'misc',
} as const satisfies Record<string, string>

export type BlockCategoryValue = (typeof BlockCategory)[keyof typeof BlockCategory]
