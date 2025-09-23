/**
 * ワールド生成に必要な共通型定義
 *
 * @module domain/world/types
 */

import { Schema, ParseResult } from '@effect/schema'

/**
 * 3次元座標を表すスキーマ
 */
export const Vector3Schema = Schema.transformOrFail(
  Schema.Unknown,
  Schema.Struct({
    x: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n), { message: () => 'x must be a finite number' })),
    y: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n), { message: () => 'y must be a finite number' })),
    z: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n), { message: () => 'z must be a finite number' })),
  }),
  {
    decode: (input, options, ast) => {
      // 入力がオブジェクトかチェック
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return ParseResult.fail(new ParseResult.Type(ast, input, 'Expected an object'))
      }

      // 追加プロパティのチェック
      const allowedKeys = ['x', 'y', 'z']
      const inputKeys = Object.keys(input)
      const hasExtraKeys = inputKeys.some((key) => !allowedKeys.includes(key))

      if (hasExtraKeys) {
        return ParseResult.fail(new ParseResult.Type(ast, input, 'No extra properties allowed'))
      }

      // 必須プロパティのチェック
      const missingKeys = allowedKeys.filter((key) => !(key in input))
      if (missingKeys.length > 0) {
        return ParseResult.fail(
          new ParseResult.Type(ast, input, `Missing required properties: ${missingKeys.join(', ')}`)
        )
      }

      // 型変換無しで入力をそのまま返す
      return ParseResult.succeed(input as any)
    },
    encode: ParseResult.succeed,
  }
)
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
export const BiomeInfoSchema = Schema.transformOrFail(
  Schema.Unknown,
  Schema.Struct({
    type: BiomeType,
    temperature: Schema.Number.pipe(
      Schema.filter((n) => Number.isFinite(n), { message: () => 'temperature must be a finite number' })
    ),
    humidity: Schema.Number.pipe(
      Schema.filter((n) => Number.isFinite(n), { message: () => 'humidity must be a finite number' })
    ),
    elevation: Schema.Number.pipe(
      Schema.filter((n) => Number.isFinite(n), { message: () => 'elevation must be a finite number' })
    ),
  }),
  {
    decode: (input, options, ast) => {
      // 入力がオブジェクトかチェック
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return ParseResult.fail(new ParseResult.Type(ast, input, 'Expected an object'))
      }

      // 追加プロパティのチェック
      const allowedKeys = ['type', 'temperature', 'humidity', 'elevation']
      const inputKeys = Object.keys(input)
      const hasExtraKeys = inputKeys.some((key) => !allowedKeys.includes(key))

      if (hasExtraKeys) {
        return ParseResult.fail(new ParseResult.Type(ast, input, 'No extra properties allowed'))
      }

      // 必須プロパティのチェック
      const missingKeys = allowedKeys.filter((key) => !(key in input))
      if (missingKeys.length > 0) {
        return ParseResult.fail(
          new ParseResult.Type(ast, input, `Missing required properties: ${missingKeys.join(', ')}`)
        )
      }

      // 型変換無しで入力をそのまま返す
      return ParseResult.succeed(input as any)
    },
    encode: ParseResult.succeed,
  }
)
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
