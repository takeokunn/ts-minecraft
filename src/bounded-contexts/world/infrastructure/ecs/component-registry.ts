/**
 * ECS Component Registry - コンポーネント管理システム
 *
 * 全コンポーネントの登録・管理・型安全性確保を担当
 * シリアライズ・デシリアライズ機能付き
 */

import { Schema } from '@effect/schema'
import { PositionComponent, VelocityComponent } from './component'

/**
 * 登録済みコンポーネント一覧
 */
export const ComponentRegistry = Schema.Struct({
  position: Schema.optional(PositionComponent),
  velocity: Schema.optional(VelocityComponent),
})

/**
 * コンポーネントレジストリの型定義
 */
export type ComponentRegistry = Schema.Schema.Type<typeof ComponentRegistry>

/**
 * 個別コンポーネント型のUnion定義
 */
export const ComponentUnion = Schema.Union(PositionComponent, VelocityComponent)

/**
 * コンポーネントUnionの型定義
 */
export type ComponentUnion = Schema.Schema.Type<typeof ComponentUnion>
