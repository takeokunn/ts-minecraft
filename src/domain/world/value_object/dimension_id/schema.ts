/**
 * @fileoverview Dimension ID Schema
 * 次元IDのBrand型定義と型安全定数
 */

import { Brand, Schema } from 'effect'

// === Brand型定義 ===

/**
 * 次元ID - Minecraftの3つの次元を識別
 *
 * 許可される値:
 * - minecraft:overworld (オーバーワールド)
 * - minecraft:nether (ネザー)
 * - minecraft:the_end (ジ・エンド)
 */
export type DimensionId = string & Brand.Brand<'DimensionId'>

/**
 * DimensionIdスキーマ - 厳密な3次元パターン検証
 */
export const DimensionIdSchema = Schema.String.pipe(
  Schema.pattern(/^minecraft:(overworld|nether|the_end)$/),
  Schema.brand('DimensionId'),
  Schema.annotations({
    title: 'Dimension ID',
    description: 'Minecraft dimension identifier (3 dimensions only)',
    examples: ['minecraft:overworld', 'minecraft:nether', 'minecraft:the_end'],
  })
)

// === 型安全定数 ===

/**
 * オーバーワールド次元ID
 * メインの地上世界
 */
export const OVERWORLD: DimensionId = 'minecraft:overworld' as DimensionId

/**
 * ネザー次元ID
 * 危険な地下世界
 */
export const NETHER: DimensionId = 'minecraft:nether' as DimensionId

/**
 * ジ・エンド次元ID
 * エンダードラゴンが存在する虚無の世界
 */
export const THE_END: DimensionId = 'minecraft:the_end' as DimensionId

/**
 * 全次元ID定数のオブジェクト
 */
export const DIMENSION_IDS = {
  OVERWORLD,
  NETHER,
  THE_END,
} as const

/**
 * 全次元IDの配列（イテレーション用）
 */
export const ALL_DIMENSIONS: ReadonlyArray<DimensionId> = [OVERWORLD, NETHER, THE_END]
