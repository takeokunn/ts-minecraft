/**
 * ECS Component基盤 - 基本コンポーネント定義
 *
 * Entity-Component-Systemアーキテクチャの基本コンポーネントを提供
 * Schema.Structを使用した型安全でシリアライズ可能な実装
 */

import { ComponentTypeNameSchema } from '@domain/entities/types'
import { Schema } from '@effect/schema'
import { makeComponentDefinition } from './index'

const toComponentType = Schema.decodeUnknownSync(ComponentTypeNameSchema)

/**
 * 位置コンポーネント - 3D空間内の座標
 */
export const PositionComponentSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}).pipe(
  Schema.annotations({
    identifier: 'PositionComponent',
    description: '3次元空間におけるワールド座標',
  })
)
export type PositionComponent = Schema.Schema.Type<typeof PositionComponentSchema>
export const PositionComponent = PositionComponentSchema

/**
 * 速度コンポーネント - 3D空間内の移動速度
 */
export const VelocityComponentSchema = Schema.Struct({
  vx: Schema.Number,
  vy: Schema.Number,
  vz: Schema.Number,
}).pipe(
  Schema.annotations({
    identifier: 'VelocityComponent',
    description: '3次元空間での速度ベクトル',
  })
)
export type VelocityComponent = Schema.Schema.Type<typeof VelocityComponentSchema>
export const VelocityComponent = VelocityComponentSchema

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
export type PlayerComponent = Schema.Schema.Type<typeof PlayerComponent>

/**
 * Positionコンポーネント定義
 */
export const PositionComponentDefinition = makeComponentDefinition({
  type: toComponentType('position'),
  schema: PositionComponentSchema,
  description: 'ワールド座標を正規化するPositionコンポーネント',
})

/**
 * Velocityコンポーネント定義
 */
export const VelocityComponentDefinition = makeComponentDefinition({
  type: toComponentType('velocity'),
  schema: VelocityComponentSchema,
  description: '移動速度を正規化するVelocityコンポーネント',
})

/**
 * レジストリへ提供する全コンポーネント定義
 */
export const AllComponentDefinitions = [PositionComponentDefinition, VelocityComponentDefinition] as const
