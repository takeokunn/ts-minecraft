/**
 * ItemBuilder設定Schema定義
 *
 * Factoryパターンで使用するBuilder設定のEffect-TS Schema定義
 * builders.tsのItemBuilderConfig型をSchema化して型安全性を強化
 */

import { Schema } from '@effect/schema'
import * as Either from 'effect/Either'
import { pipe } from 'effect/Function'
import { ItemCategorySchema, ItemQualitySchema, ItemRaritySchema } from '../../types/item_enums'

/**
 * アイテムビルダー設定Schema
 *
 * ItemFactoryでアイテム生成時に使用する設定オブジェクト
 * 全てのフィールドは実行時バリデーションで保護される
 */
export const ItemBuilderConfigSchema = Schema.Struct({
  // 必須フィールド
  category: ItemCategorySchema,
  quality: ItemQualitySchema,
  stackable: Schema.Boolean,
  maxStackSize: Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.between(1, 64)),

  // オプショナルフィールド
  rarity: Schema.optional(ItemRaritySchema),
  durability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  maxDurability: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  enchantable: Schema.optional(Schema.Boolean),
  count: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.between(1, 64))),
})

export type ItemBuilderConfig = Schema.Schema.Type<typeof ItemBuilderConfigSchema>

/**
 * Builder設定の安全な構築関数
 *
 * Schema.decode()で実行時バリデーション付き
 * バリデーション失敗時はParseErrorをthrow
 *
 * @param config - 構築する設定オブジェクト
 * @returns バリデーション済みItemBuilderConfig
 * @throws ParseError バリデーション失敗時
 */
export const makeItemBuilderConfig = (
  config: Schema.Schema.Encoded<typeof ItemBuilderConfigSchema>
): ItemBuilderConfig =>
  pipe(
    Schema.decodeUnknownEither(ItemBuilderConfigSchema)(config),
    Either.getOrElse((error) => {
      throw error
    })
  )

/**
 * パフォーマンス重視用（信頼できる入力のみ使用）
 *
 * バリデーションをスキップして型変換のみ実行
 * 内部実装で既にバリデーション済みのデータに使用
 *
 * ⚠️ 警告: 信頼できない外部入力には使用しないこと
 *
 * @param config - 既にバリデーション済みの設定
 * @returns 型変換のみ行ったItemBuilderConfig
 */
export const makeUnsafeItemBuilderConfig = (config: ItemBuilderConfig): ItemBuilderConfig => config
