/**
 * ワールド生成に必要な共通型定義
 *
 * @module domain/world/types
 */

import { Schema } from '@effect/schema'

/**
 * 3次元座標を表すスキーマ
 */
export const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
export type Vector3 = Schema.Schema.Type<typeof Vector3Schema>

/**
 * バイオームタイプの定義
 */
export const BiomeType = Schema.Literal(
  'plains',
  'desert',
  'forest',
  'jungle',
  'swamp',
  'taiga',
  'snowy_tundra',
  'mountains',
  'ocean',
  'river',
  'beach',
  'mushroom_fields',
  'savanna',
  'badlands',
  'nether',
  'end',
  'void'
)
export type BiomeType = Schema.Schema.Type<typeof BiomeType>

/**
 * バイオーム情報
 */
export const BiomeInfoSchema = Schema.Struct({
  type: BiomeType,
  temperature: Schema.Number,
  humidity: Schema.Number,
  elevation: Schema.Number,
})
export type BiomeInfo = Schema.Schema.Type<typeof BiomeInfoSchema>

/**
 * 構造物の基本情報
 */
export const StructureSchema = Schema.Struct({
  type: Schema.String,
  position: Vector3Schema,
  boundingBox: Schema.Struct({
    min: Vector3Schema,
    max: Vector3Schema,
  }),
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})
export type Structure = Schema.Schema.Type<typeof StructureSchema>
