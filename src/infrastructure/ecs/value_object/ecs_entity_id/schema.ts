import { Schema } from 'effect'

// -----------------------------------------------------------------------------
// ECSEntityId Brand型定義（number型）
// -----------------------------------------------------------------------------

/**
 * ECS層エンティティ識別子
 * Integer-based entity identifier for ECS layer (high performance)
 *
 * Format: 非負整数
 * Example: 0, 1, 42, 1000
 */
export const ECSEntityIdSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('ECSEntityId'),
  Schema.annotations({
    title: 'ECS Entity ID',
    description: 'Integer-based entity identifier for ECS layer (high performance)',
    examples: [0, 1, 42, 1000],
  })
)

export type ECSEntityId = Schema.Schema.Type<typeof ECSEntityIdSchema>

// -----------------------------------------------------------------------------
// 特殊値定義
// -----------------------------------------------------------------------------

/**
 * 無効なECSEntityIdを表す特殊値
 * 初期化前やエラー状態を示すために使用
 */
export const INVALID_ECS_ENTITY_ID: ECSEntityId = -1 as ECSEntityId
