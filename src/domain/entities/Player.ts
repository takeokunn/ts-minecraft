import { Schema } from 'effect'
import type { PlayerId, EntityId } from '../../shared/types/branded.js'
import { Vector3Schema, RotationSchema } from '../../shared/schemas/spatial.js'
import { InventorySchema } from '../inventory/Inventory.js'
import { EquipmentSchema } from '../equipment/Equipment.js'

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
  id: Schema.String,
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
  playerId: Schema.String,
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

// デフォルト値定義
export const DEFAULT_PLAYER_STATS: PlayerStats = {
  health: 20,
  maxHealth: 20,
  hunger: 20,
  saturation: 20,
  experience: 0,
  level: 0,
  armor: 0,
}

export const DEFAULT_PLAYER_ABILITIES: PlayerAbilities = {
  canFly: false,
  isFlying: false,
  canBreakBlocks: true,
  canPlaceBlocks: true,
  invulnerable: false,
  walkSpeed: 4.317, // Minecraft default walk speed (blocks/second)
  flySpeed: 10.92, // Minecraft default fly speed
}

// ゲームモード別能力設定
export const getAbilitiesForGameMode = (gameMode: GameMode): PlayerAbilities => {
  switch (gameMode) {
    case 'creative':
      return {
        ...DEFAULT_PLAYER_ABILITIES,
        canFly: true,
        invulnerable: true,
      }
    case 'spectator':
      return {
        ...DEFAULT_PLAYER_ABILITIES,
        canFly: true,
        isFlying: true,
        canBreakBlocks: false,
        canPlaceBlocks: false,
        invulnerable: true,
      }
    case 'adventure':
      return {
        ...DEFAULT_PLAYER_ABILITIES,
        canBreakBlocks: false,
      }
    case 'survival':
    default:
      return DEFAULT_PLAYER_ABILITIES
  }
}
