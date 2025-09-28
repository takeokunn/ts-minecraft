import { PlayerIdSchema } from '@domain/core/types/brands'
import { RotationSchema, Vector3Schema } from '@domain/core/types/spatial'
import { Schema } from '@effect/schema'
import { EquipmentSchema } from '@domain/equipment'
import { InventorySchema } from '@domain/inventory'

// ゲームモード定義
export const GameMode = Schema.Literal('survival', 'creative', 'adventure', 'spectator')
export type GameMode = Schema.Schema.Type<typeof GameMode>

// プレイヤー統計情報
export const PlayerStats = Schema.Struct({
  health: Schema.Number.pipe(Schema.between(0, 20)),
  maxHealth: Schema.Number.pipe(Schema.between(1, 20)),
  hunger: Schema.Number.pipe(Schema.between(0, 20)),
  saturation: Schema.Number.pipe(Schema.between(0, 20)),
  experience: Schema.Number.pipe(Schema.between(0, Number.MAX_SAFE_INTEGER)),
  level: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  armor: Schema.Number.pipe(Schema.between(0, 20)),
})
export type PlayerStats = Schema.Schema.Type<typeof PlayerStats>

// プレイヤー能力設定
export const PlayerAbilities = Schema.Struct({
  canFly: Schema.Boolean,
  isFlying: Schema.Boolean,
  canBreakBlocks: Schema.Boolean,
  canPlaceBlocks: Schema.Boolean,
  invulnerable: Schema.Boolean,
  walkSpeed: Schema.Number.pipe(Schema.positive()),
  flySpeed: Schema.Number.pipe(Schema.positive()),
})
export type PlayerAbilities = Schema.Schema.Type<typeof PlayerAbilities>

// プレイヤーエンティティ定義
export const Player = Schema.Struct({
  id: PlayerIdSchema,
  entityId: Schema.Number,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(16)),
  position: Vector3Schema,
  rotation: RotationSchema,
  velocity: Vector3Schema,
  stats: PlayerStats,
  gameMode: GameMode,
  abilities: PlayerAbilities,
  inventory: InventorySchema,
  equipment: EquipmentSchema,
  isOnGround: Schema.Boolean,
  isSneaking: Schema.Boolean,
  isSprinting: Schema.Boolean,
  lastUpdate: Schema.Number,
  createdAt: Schema.Number,
})
export type Player = Schema.Schema.Type<typeof Player>

// プレイヤー作成設定
export const PlayerCreateConfig = Schema.Struct({
  playerId: PlayerIdSchema,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(16)),
  initialPosition: Schema.optional(Vector3Schema),
  initialRotation: Schema.optional(RotationSchema),
  gameMode: Schema.optional(GameMode),
  health: Schema.optional(Schema.Number.pipe(Schema.between(1, 20))),
})
export type PlayerCreateConfig = Schema.Schema.Type<typeof PlayerCreateConfig>

// プレイヤー更新データ
export const PlayerUpdateData = Schema.Struct({
  position: Schema.optional(Vector3Schema),
  rotation: Schema.optional(RotationSchema),
  velocity: Schema.optional(Vector3Schema),
  health: Schema.optional(Schema.Number.pipe(Schema.between(0, 20))),
  hunger: Schema.optional(Schema.Number.pipe(Schema.between(0, 20))),
  gameMode: Schema.optional(GameMode),
  isSneaking: Schema.optional(Schema.Boolean),
  isSprinting: Schema.optional(Schema.Boolean),
})
export type PlayerUpdateData = Schema.Schema.Type<typeof PlayerUpdateData>
