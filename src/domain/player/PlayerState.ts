import { Schema } from '@effect/schema'
import { Player } from '../entities/Player'
import { Vector3Schema } from '@domain/core/types/spatial'

// 移動方向の入力状態
export const Direction = Schema.Struct({
  forward: Schema.Boolean,
  backward: Schema.Boolean,
  left: Schema.Boolean,
  right: Schema.Boolean,
  jump: Schema.Boolean,
  sneak: Schema.Boolean,
  sprint: Schema.Boolean,
})
export type Direction = Schema.Schema.Type<typeof Direction>

// プレイヤーアクション定義 (Tagged Union)
export const PlayerAction = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Move'),
    direction: Direction,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Jump'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Attack'),
    targetId: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('UseItem'),
    slotIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 35)),
    target: Schema.optional(Vector3Schema),
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlaceBlock'),
    position: Vector3Schema,
    face: Schema.Literal('top', 'bottom', 'north', 'south', 'east', 'west'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('BreakBlock'),
    position: Vector3Schema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('OpenContainer'),
    position: Vector3Schema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('DropItem'),
    slotIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 35)),
    count: Schema.Number.pipe(Schema.int(), Schema.positive()),
  })
)
export type PlayerAction = Schema.Schema.Type<typeof PlayerAction>

// ダメージソース定義
export const DamageSource = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Fall'),
    distance: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Entity'),
    entityId: Schema.String,
    damage: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Environment'),
    type: Schema.Literal('lava', 'drowning', 'suffocation', 'void', 'fire'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Hunger'),
  })
)
export type DamageSource = Schema.Schema.Type<typeof DamageSource>

// プレイヤー物理状態
export const PlayerPhysicsState = Schema.Struct({
  velocity: Vector3Schema,
  acceleration: Vector3Schema,
  mass: Schema.Number.pipe(Schema.positive()),
  friction: Schema.Number.pipe(Schema.between(0, 1)),
  restitution: Schema.Number.pipe(Schema.between(0, 1)),
  isOnGround: Schema.Boolean,
  isInWater: Schema.Boolean,
  isInLava: Schema.Boolean,
  isCollidingX: Schema.Boolean,
  isCollidingY: Schema.Boolean,
  isCollidingZ: Schema.Boolean,
})
export type PlayerPhysicsState = Schema.Schema.Type<typeof PlayerPhysicsState>

// デフォルト物理状態
export const DEFAULT_PHYSICS_STATE: PlayerPhysicsState = {
  velocity: { x: 0, y: 0, z: 0 },
  acceleration: { x: 0, y: -32, z: 0 }, // Minecraft gravity (~2x real world)
  mass: 70, // kg
  friction: 0.6, // Ground friction
  restitution: 0.0, // No bounce
  isOnGround: false,
  isInWater: false,
  isInLava: false,
  isCollidingX: false,
  isCollidingY: false,
  isCollidingZ: false,
}

// 移動速度定数
export const MOVEMENT_SPEEDS = {
  WALK: 4.317, // blocks/second
  SPRINT: 5.612, // blocks/second (1.3x walk)
  SNEAK: 1.295, // blocks/second (0.3x walk)
  FLY: 10.92, // blocks/second
  SWIM: 2.0, // blocks/second
  CLIMB: 2.0, // blocks/second
} as const

// ジャンプ高さ定数
export const JUMP_VELOCITY = 8.0 // Initial upward velocity for jump (results in ~1.25 blocks height)

// 物理定数
export const PHYSICS_CONSTANTS = {
  GRAVITY: -32.0, // blocks/s²
  WATER_GRAVITY: -8.0, // Reduced gravity in water
  LAVA_GRAVITY: -4.0, // Even more reduced in lava
  AIR_RESISTANCE: 0.98, // Horizontal drag coefficient
  WATER_RESISTANCE: 0.8, // Water drag
  LAVA_RESISTANCE: 0.5, // Lava drag
  TERMINAL_VELOCITY: -60.0, // Maximum fall speed
} as const
