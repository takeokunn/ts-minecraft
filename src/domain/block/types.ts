import { Schema } from '@effect/schema'
import { Brand } from 'effect'

// ブロックIDのBranded型
export type BlockId = string & Brand.Brand<'BlockId'>
export const BlockId = Brand.nominal<BlockId>()

// テクスチャIDのBranded型
export type TextureId = string & Brand.Brand<'TextureId'>
export const TextureId = Brand.nominal<TextureId>()

// ツールタイプの定義
export const ToolTypeSchema = Schema.Literal('none', 'pickaxe', 'axe', 'shovel', 'hoe', 'shears', 'sword')
export type ToolType = Schema.Schema.Type<typeof ToolTypeSchema>

// テクスチャ面の定義
export const TextureFacesSchema = Schema.Struct({
  top: Schema.String,
  bottom: Schema.String,
  north: Schema.String,
  south: Schema.String,
  east: Schema.String,
  west: Schema.String,
})
export type TextureFaces = Schema.Schema.Type<typeof TextureFacesSchema>

// 簡略版テクスチャ定義（全面同じ場合）
export const SimpleTextureSchema = Schema.String

// テクスチャ定義（全面同じまたは面別指定）
export const BlockTextureSchema = Schema.Union(SimpleTextureSchema, TextureFacesSchema)
export type BlockTexture = Schema.Schema.Type<typeof BlockTextureSchema>

// ドロップアイテムの定義
export const ItemDropSchema = Schema.Struct({
  itemId: Schema.String,
  minCount: Schema.Number,
  maxCount: Schema.Number,
  chance: Schema.Number, // 0.0 - 1.0
})
export type ItemDrop = Schema.Schema.Type<typeof ItemDropSchema>

// 音の定義
export const BlockSoundSchema = Schema.Struct({
  break: Schema.String,
  place: Schema.String,
  step: Schema.String,
})
export type BlockSound = Schema.Schema.Type<typeof BlockSoundSchema>

// ブロックの物理特性
export const BlockPhysicsSchema = Schema.Struct({
  hardness: Schema.Number, // 破壊に必要な時間の基準値
  resistance: Schema.Number, // 爆発耐性
  luminance: Schema.Number, // 発光レベル (0-15)
  opacity: Schema.Number, // 不透明度 (0-15)
  flammable: Schema.Boolean,
  gravity: Schema.Boolean, // 重力の影響を受けるか
  solid: Schema.Boolean, // 固体ブロックか
  replaceable: Schema.Boolean, // 他のブロックで置き換え可能か
  waterloggable: Schema.Boolean, // 水没可能か
})
export type BlockPhysics = Schema.Schema.Type<typeof BlockPhysicsSchema>

// ブロックカテゴリーの定義
export const BlockCategorySchema = Schema.Literal(
  'natural', // 自然生成ブロック
  'building', // 建築用ブロック
  'decoration', // 装飾ブロック
  'redstone', // レッドストーン関連
  'transportation', // 移動関連
  'miscellaneous', // その他
  'food', // 食料関連
  'tools', // ツール関連
  'combat' // 戦闘関連
)
export type BlockCategory = Schema.Schema.Type<typeof BlockCategorySchema>

// 基本ブロック定義
export const BlockTypeSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  category: BlockCategorySchema,
  texture: BlockTextureSchema,
  physics: BlockPhysicsSchema,
  tool: ToolTypeSchema,
  minToolLevel: Schema.Number, // 必要なツールレベル (0: 木, 1: 石, 2: 鉄, 3: ダイヤ, 4: ネザライト)
  drops: Schema.Array(ItemDropSchema),
  sound: BlockSoundSchema,
  stackSize: Schema.Number,
  tags: Schema.Array(Schema.String), // カスタムタグ
})

export type BlockType = Schema.Schema.Type<typeof BlockTypeSchema>
export type BlockTypeEncoded = Schema.Schema.Encoded<typeof BlockTypeSchema>
