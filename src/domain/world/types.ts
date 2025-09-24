/**
 * ワールド生成に必要な共通型定義
 *
 * @module domain/world/types
 */

import { Schema, ParseResult } from '@effect/schema'
import { Match, Option, pipe, Predicate } from 'effect'

/**
 * オブジェクト検証のヘルパー関数
 */
const validateObjectInput = (input: unknown, ast: any) =>
  pipe(
    Option.fromNullable(
      Predicate.isRecord(input) && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : null
    ),
    Option.match({
      onNone: () => ParseResult.fail(new ParseResult.Type(ast, input, 'Expected an object')),
      onSome: (obj) => ParseResult.succeed(obj),
    })
  )

/**
 * 追加プロパティをチェックするヘルパー関数
 */
const validateNoExtraKeys = (input: Record<string, unknown>, allowedKeys: string[], ast: any) =>
  pipe(
    input,
    (obj) => Object.keys(obj).some((key) => !allowedKeys.includes(key)),
    (hasExtraKeys) =>
      Match.value(hasExtraKeys).pipe(
        Match.when(true, () => ParseResult.fail(new ParseResult.Type(ast, input, 'No extra properties allowed'))),
        Match.when(false, () => ParseResult.succeed(input)),
        Match.exhaustive
      )
  )

/**
 * 必須プロパティをチェックするヘルパー関数
 */
const validateRequiredKeys = (input: Record<string, unknown>, requiredKeys: string[], ast: any) => {
  const missingKeys = requiredKeys.filter((key) => !(key in input))
  return pipe(
    Match.value(missingKeys.length > 0).pipe(
      Match.when(true, () =>
        ParseResult.fail(new ParseResult.Type(ast, input, `Missing required properties: ${missingKeys.join(', ')}`))
      ),
      Match.when(false, () => ParseResult.succeed(input)),
      Match.exhaustive
    )
  )
}

/**
 * スキーマ検証のメイン関数
 */
const validateSchemaInput = (input: unknown, allowedKeys: string[], ast: any) => {
  // オブジェクト検証
  const objectResult = validateObjectInput(input, ast)

  return pipe(
    objectResult._tag === 'Left',
    Match.value,
    Match.when(true, () => objectResult), // エラーの場合は早期リターン
    Match.when(false, () => {
      const validatedObject = objectResult.right

      // 追加プロパティチェック
      const extraKeysResult = validateNoExtraKeys(validatedObject, allowedKeys, ast)

      return pipe(
        extraKeysResult._tag === 'Left',
        Match.value,
        Match.when(true, () => extraKeysResult), // エラーの場合は早期リターン
        Match.when(false, () => {
          // 必須プロパティチェック
          const requiredKeysResult = validateRequiredKeys(validatedObject, allowedKeys, ast)

          return pipe(
            requiredKeysResult._tag === 'Left',
            Match.value,
            Match.when(true, () => requiredKeysResult), // エラーの場合は早期リターン
            Match.when(false, () => ParseResult.succeed(input as any)),
            Match.exhaustive
          )
        }),
        Match.exhaustive
      )
    }),
    Match.exhaustive
  )
}

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
    decode: (input, options, ast) => validateSchemaInput(input, ['x', 'y', 'z'], ast),
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
    decode: (input, options, ast) => validateSchemaInput(input, ['type', 'temperature', 'humidity', 'elevation'], ast),
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
