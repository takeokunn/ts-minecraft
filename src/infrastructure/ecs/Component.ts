/**
 * ECS Component基盤 - 基本コンポーネント定義
 *
 * Entity-Component-Systemアーキテクチャの基本コンポーネントを提供
 * Schema.Structを使用した型安全でシリアライズ可能な実装
 */

import { Schema } from 'effect'

/**
 * 位置コンポーネント - 3D空間内の座標
 */
export const PositionComponent = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

/**
 * 速度コンポーネント - 3D空間内の移動速度
 */
export const VelocityComponent = Schema.Struct({
  vx: Schema.Number,
  vy: Schema.Number,
  vz: Schema.Number,
})

/**
 * 位置コンポーネントの型定義
 */
export type PositionComponent = Schema.Schema.Type<typeof PositionComponent>

/**
 * 速度コンポーネントの型定義
 */
export type VelocityComponent = Schema.Schema.Type<typeof VelocityComponent>

/**
 * 移動コンポーネント - プレイヤー移動関連のプロパティ
 */
export const MovementComponent = Schema.Struct({
  /** プレイヤーの移動速度（m/s） */
  speed: Schema.Number.pipe(Schema.positive()),
  /** ジャンプ力 */
  jumpForce: Schema.Number.pipe(Schema.positive()),
  /** プレイヤーの向き（ヨー角、度） */
  yaw: Schema.Number,
  /** プレイヤーの向き（ピッチ角、度） */
  pitch: Schema.Number,
})

/**
 * 移動コンポーネントの型定義
 */
export type MovementComponent = Schema.Schema.Type<typeof MovementComponent>

/**
 * プレイヤーコンポーネント - プレイヤー固有の状態
 */
export const PlayerComponent = Schema.Struct({
  /** プレイヤーID */
  playerId: Schema.Number,
  /** ヘルス */
  health: Schema.Number.pipe(Schema.positive()),
  /** ゲームモード */
  gameMode: Schema.Literal('Creative', 'Survival', 'Spectator', 'Adventure'),
  /** 地面にいるかどうか */
  isGrounded: Schema.Boolean,
  /** 生存状態 */
  isAlive: Schema.Boolean,
  /** 経験値 */
  experiencePoints: Schema.Number.pipe(Schema.nonNegative()),
})

/**
 * プレイヤーコンポーネントの型定義
 */
export type PlayerComponent = Schema.Schema.Type<typeof PlayerComponent>
