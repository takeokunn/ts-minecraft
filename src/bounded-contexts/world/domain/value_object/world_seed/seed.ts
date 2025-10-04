/**
 * WorldSeed Value Object - ワールド生成のシード値を表現する不変オブジェクト
 *
 * DDD原則に基づき、シード値の自己検証、不変性、型安全性を保証
 * Effect-TS 3.17+ Schema + Brand型による完全型安全実装
 */

import { Schema } from 'effect'
import { Brand } from 'effect'
import type { Brand as BrandType } from 'effect'
import { taggedUnion } from '../../utils/schema'

/**
 * WorldSeed Brand型 - 型レベルでの識別保証
 */
export type WorldSeedBrand = number & BrandType.Brand<'WorldSeed'>

/**
 * WorldSeed Schema - 実行時検証とBrand型変換
 *
 * 制約:
 * - 32bit符号付き整数範囲内 (-2147483648 ~ 2147483647)
 * - NaN, Infinity は禁止
 * - 浮動小数点数は整数に変換
 */
export const WorldSeedSchema = Schema.Number.pipe(
  Schema.finite(), // NaN, Infinity除外
  Schema.int(), // 整数制約
  Schema.between(-2147483648, 2147483647), // 32bit範囲制約
  Schema.brand('WorldSeed'),
  Schema.annotations({
    identifier: 'WorldSeed',
    title: 'World Generation Seed',
    description: 'A deterministic seed value for world generation ensuring reproducible results',
    examples: [123456789, -987654321, 0]
  })
)

/**
 * エントロピーレベル - シードの複雑性を表現
 */
export const EntropyLevelSchema = Schema.Literal('low', 'medium', 'high').pipe(
  Schema.annotations({
    title: 'Entropy Level',
    description: 'Represents the complexity and randomness of the seed'
  })
)

export type EntropyLevel = typeof EntropyLevelSchema.Type

/**
 * タイムスタンプ - シード生成時刻
 */
export const TimestampSchema = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand('Timestamp'),
  Schema.annotations({
    title: 'Creation Timestamp',
    description: 'Unix timestamp when the seed was created'
  })
)

export type Timestamp = typeof TimestampSchema.Type

/**
 * WorldSeed Value Object - 完全なワールドシード仕様
 */
export const WorldSeedValueObjectSchema = Schema.Struct({
  value: WorldSeedSchema,
  timestamp: TimestampSchema,
  entropy: EntropyLevelSchema,

  // 人間が読みやすい表現
  humanReadable: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.annotations({
      description: 'Human-readable representation of the seed (optional)'
    })
  ).pipe(Schema.optional),

  // 生成コンテキスト
  context: Schema.Struct({
    generator: Schema.Literal('random', 'timestamp', 'string', 'custom'),
    source: Schema.String.pipe(Schema.optional)
  }).pipe(Schema.optional)
})

export type WorldSeed = typeof WorldSeedValueObjectSchema.Type

/**
 * WorldSeed作成パラメータ
 */
export const CreateWorldSeedParamsSchema = Schema.Struct({
  value: Schema.Union(Schema.Number, Schema.String).pipe(Schema.optional),
  humanReadable: Schema.String.pipe(Schema.optional),
  generator: Schema.Literal('random', 'timestamp', 'string', 'custom').pipe(Schema.optional),
  source: Schema.String.pipe(Schema.optional)
})

export type CreateWorldSeedParams = typeof CreateWorldSeedParamsSchema.Type

/**
 * WorldSeedエラー型
 */
export const WorldSeedErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('InvalidSeedValue'),
    value: Schema.Unknown,
    message: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal('SeedGenerationError'),
    cause: Schema.String,
    message: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal('ValidationError'),
    field: Schema.String,
    value: Schema.Unknown,
    message: Schema.String
  })
])

export type WorldSeedError = typeof WorldSeedErrorSchema.Type

/**
 * シード品質評価結果
 */
export const SeedQualitySchema = Schema.Struct({
  score: Schema.Number.pipe(Schema.between(0, 100)),
  entropy: EntropyLevelSchema,
  distribution: Schema.Struct({
    uniformity: Schema.Number.pipe(Schema.between(0, 1)),
    complexity: Schema.Number.pipe(Schema.between(0, 1))
  }),
  recommendations: Schema.Array(Schema.String)
})

export type SeedQuality = typeof SeedQualitySchema.Type
