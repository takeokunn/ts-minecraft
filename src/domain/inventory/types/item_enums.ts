/**
 * アイテム分類Enum定義
 *
 * Minecraft標準のアイテム分類・品質・レアリティをSchema.Literalで型安全に定義
 * Effect-TS Schema.Literal パターンによる実行時バリデーション付き
 */

import { Schema } from '@effect/schema'

/**
 * アイテムカテゴリ（10種類）
 *
 * Minecraft標準のアイテム分類
 * - tool: ツール類（斧・ピッケル等）
 * - weapon: 武器類（剣・弓等）
 * - armor: 防具類（ヘルメット・チェストプレート等）
 * - food: 食料類（パン・リンゴ等）
 * - block: ブロック類（石・土等）
 * - resource: 資源類（鉱石・木材等）
 * - consumable: 消費アイテム類（ポーション等）
 * - redstone: レッドストーン関連（回路部品等）
 * - decoration: 装飾ブロック類（花・絵画等）
 * - misc: その他雑多なアイテム
 */
export const ItemCategorySchema = Schema.Literal(
  'tool',
  'weapon',
  'armor',
  'food',
  'block',
  'resource',
  'consumable',
  'redstone',
  'decoration',
  'misc'
)
export type ItemCategory = Schema.Schema.Type<typeof ItemCategorySchema>

/**
 * アイテム品質（5段階）
 *
 * レアリティシステムで使用される品質グレード
 * - common: 一般的（白色表示）
 * - uncommon: 珍しい（緑色表示）
 * - rare: レア（青色表示）
 * - epic: エピック（紫色表示）
 * - legendary: 伝説的（金色表示）
 */
export const ItemQualitySchema = Schema.Literal('common', 'uncommon', 'rare', 'epic', 'legendary')
export type ItemQuality = Schema.Schema.Type<typeof ItemQualitySchema>

/**
 * アイテムレアリティ（4段階）
 *
 * ドロップ率計算・宝箱生成で使用
 * - common: 一般的（ドロップ率高）
 * - rare: レア（ドロップ率中）
 * - epic: エピック（ドロップ率低）
 * - legendary: 伝説的（ドロップ率極低）
 */
export const ItemRaritySchema = Schema.Literal('common', 'rare', 'epic', 'legendary')
export type ItemRarity = Schema.Schema.Type<typeof ItemRaritySchema>
