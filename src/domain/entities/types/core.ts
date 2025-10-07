import { Schema } from 'effect'

const nonEmptyText = Schema.String.pipe(Schema.minLength(1))

// -----------------------------------------------------------------------------
// Branded Scalar Types
// -----------------------------------------------------------------------------

// 共有カーネルから再エクスポート
export { BlockIdSchema, type BlockId } from '@domain/shared/entities/block_id'
export { BlockTypeIdSchema, type BlockTypeId } from '@domain/shared/entities/block_type_id'
export { EntityIdSchema, type EntityId } from '@domain/shared/entities/entity_id'
export { ItemIdSchema, type ItemId } from '@domain/shared/entities/item_id'
export { PlayerIdSchema, type PlayerId } from '@domain/shared/entities/player_id'
export { WorldIdSchema, type WorldId } from '@domain/shared/entities/world_id'

export const SessionIdSchema = nonEmptyText.pipe(
  Schema.brand('SessionId'),
  Schema.annotations({
    title: 'SessionId',
    description: 'Identifier for interaction or gameplay sessions',
  })
)
export type SessionId = Schema.Schema.Type<typeof SessionIdSchema>

export const EntityCountSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('EntityCount'),
  Schema.annotations({
    title: 'EntityCount',
    description: 'Number of entities in a collection',
  })
)
export type EntityCount = Schema.Schema.Type<typeof EntityCountSchema>

export const EntityCapacitySchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand('EntityCapacity'),
  Schema.annotations({
    title: 'EntityCapacity',
    description: 'Maximum number of entities allowed',
  })
)
export type EntityCapacity = Schema.Schema.Type<typeof EntityCapacitySchema>

export const ComponentTypeNameSchema = nonEmptyText.pipe(
  Schema.brand('ComponentTypeName'),
  Schema.annotations({
    title: 'ComponentTypeName',
    description: 'Identifier for ECS component categories',
  })
)
export type ComponentTypeName = Schema.Schema.Type<typeof ComponentTypeNameSchema>

// Re-export from units with alias
export { MillisecondsSchema as DeltaTimeSchema, type Milliseconds as DeltaTime } from '../../shared/value_object/units'

// -----------------------------------------------------------------------------
// Spatial Types
// -----------------------------------------------------------------------------

export const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}).pipe(
  Schema.annotations({
    title: 'Vector3D',
    description: 'Three dimensional vector',
  })
)
export type Vector3D = Schema.Schema.Type<typeof Vector3Schema>

export const BlockPositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
}).pipe(
  Schema.annotations({
    title: 'BlockPosition',
    description: 'Discrete block coordinate',
  })
)
export type BlockPosition = Schema.Schema.Type<typeof BlockPositionSchema>

export const RotationSchema = Schema.Struct({
  pitch: Schema.Number.pipe(Schema.between(-90, 90)),
  yaw: Schema.Number.pipe(Schema.between(-180, 180)),
  roll: Schema.Number,
}).pipe(
  Schema.annotations({
    title: 'Rotation',
    description: 'Euler rotation representation',
  })
)
export type Rotation = Schema.Schema.Type<typeof RotationSchema>

export const VelocitySchema = Vector3Schema.pipe(
  Schema.annotations({
    title: 'Velocity',
    description: 'Instantaneous velocity vector',
  })
)
export type Velocity = Schema.Schema.Type<typeof VelocitySchema>

// -----------------------------------------------------------------------------
// Player Aggregate Types
// -----------------------------------------------------------------------------

export const GameModeSchema = Schema.Literal('survival', 'creative', 'adventure', 'spectator')
export type GameMode = Schema.Schema.Type<typeof GameModeSchema>

export const PlayerStatsSchema = Schema.Struct({
  health: Schema.Number.pipe(Schema.between(0, 20)),
  maxHealth: Schema.Number.pipe(Schema.between(1, 20)),
  hunger: Schema.Number.pipe(Schema.between(0, 20)),
  saturation: Schema.Number.pipe(Schema.between(0, 20)),
  experience: Schema.Number.pipe(Schema.nonNegative()),
  level: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  armor: Schema.Number.pipe(Schema.between(0, 20)),
}).pipe(
  Schema.annotations({
    title: 'PlayerStats',
    description: 'Mutable statistics for a player entity',
  })
)
export type PlayerStats = Schema.Schema.Type<typeof PlayerStatsSchema>

export const PlayerAbilitiesSchema = Schema.Struct({
  canFly: Schema.Boolean,
  isFlying: Schema.Boolean,
  canBreakBlocks: Schema.Boolean,
  canPlaceBlocks: Schema.Boolean,
  invulnerable: Schema.Boolean,
  walkSpeed: Schema.Number.pipe(Schema.positive()),
  flySpeed: Schema.Number.pipe(Schema.positive()),
}).pipe(
  Schema.annotations({
    title: 'PlayerAbilities',
    description: 'Ability flags for player entities',
  })
)
export type PlayerAbilities = Schema.Schema.Type<typeof PlayerAbilitiesSchema>

const EquipmentPieceSchema = Schema.Struct({
  slot: Schema.String,
  itemId: Schema.String,
  metadata: Schema.optional(Schema.Unknown),
}).pipe(
  Schema.annotations({
    title: 'PlayerEquipmentPiece',
    description: 'Minimal representation of equipped item',
  })
)

const EquipmentSlotsSchema = Schema.Record({
  key: Schema.String,
  value: Schema.optional(EquipmentPieceSchema),
})

export const PlayerEquipmentSchema = Schema.Struct({
  id: Schema.String,
  ownerId: PlayerIdSchema,
  slots: EquipmentSlotsSchema,
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  version: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}).pipe(
  Schema.annotations({
    title: 'PlayerEquipment',
    description: 'Simplified equipment loadout for player state',
  })
)
export type PlayerEquipment = Schema.Schema.Type<typeof PlayerEquipmentSchema>

export const PlayerInventorySchema = Schema.Struct({
  id: Schema.String,
  ownerId: PlayerIdSchema,
  slots: Schema.Array(Schema.optional(Schema.Unknown)),
  hotbar: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  selectedSlot: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  version: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}).pipe(
  Schema.annotations({
    title: 'PlayerInventory',
    description: 'Simplified inventory snapshot for player state',
  })
)
export type PlayerInventory = Schema.Schema.Type<typeof PlayerInventorySchema>

export const PlayerSchema = Schema.Struct({
  id: PlayerIdSchema,
  entityId: EntityIdSchema,
  name: nonEmptyText.pipe(Schema.maxLength(32)),
  position: Vector3Schema,
  rotation: RotationSchema,
  velocity: Vector3Schema,
  stats: PlayerStatsSchema,
  gameMode: GameModeSchema,
  abilities: PlayerAbilitiesSchema,
  inventory: PlayerInventorySchema,
  equipment: PlayerEquipmentSchema,
  isOnGround: Schema.Boolean,
  isSneaking: Schema.Boolean,
  isSprinting: Schema.Boolean,
  lastUpdate: Schema.Number,
  createdAt: Schema.Number,
}).pipe(
  Schema.annotations({
    title: 'Player',
    description: 'Canonical representation of a player entity',
  })
)
export type Player = Schema.Schema.Type<typeof PlayerSchema>

export const PlayerCreateConfigSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  name: nonEmptyText.pipe(Schema.maxLength(32)),
  initialPosition: Schema.optional(Vector3Schema),
  initialRotation: Schema.optional(RotationSchema),
  gameMode: Schema.optional(GameModeSchema),
  health: Schema.optional(Schema.Number.pipe(Schema.between(1, 20))),
}).pipe(
  Schema.annotations({
    title: 'PlayerCreateConfig',
    description: 'Configuration used when instantiating players',
  })
)
export type PlayerCreateConfig = Schema.Schema.Type<typeof PlayerCreateConfigSchema>

export const PlayerUpdateDataSchema = Schema.Struct({
  position: Schema.optional(Vector3Schema),
  rotation: Schema.optional(RotationSchema),
  velocity: Schema.optional(Vector3Schema),
  health: Schema.optional(Schema.Number.pipe(Schema.between(0, 20))),
  hunger: Schema.optional(Schema.Number.pipe(Schema.between(0, 20))),
  gameMode: Schema.optional(GameModeSchema),
  isSneaking: Schema.optional(Schema.Boolean),
  isSprinting: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    title: 'PlayerUpdateData',
    description: 'Patch payload for mutating players',
  })
)
export type PlayerUpdateData = Schema.Schema.Type<typeof PlayerUpdateDataSchema>

// -----------------------------------------------------------------------------
// Helper Constructors
// -----------------------------------------------------------------------------

export const BrandedTypes = {
  // DomainEntityId.makeUnsafe使用に移行推奨
  createEntityId: (value: string): EntityId => Schema.decodeSync(EntityIdSchema)(value),
  createPlayerId: (value: string): PlayerId => Schema.decodeSync(PlayerIdSchema)(value),
  createBlockId: (value: string): BlockId => Schema.decodeSync(BlockIdSchema)(value),
  createBlockTypeId: (value: number): BlockTypeId => Schema.decodeSync(BlockTypeIdSchema)(value),
  createItemId: (value: string): ItemId => Schema.decodeSync(ItemIdSchema)(value),
  createSessionId: (value: string): SessionId => Schema.decodeSync(SessionIdSchema)(value),
  createWorldId: (value: string): WorldId => Schema.decodeSync(WorldIdSchema)(value),
  createEntityCount: (value: number): EntityCount => Schema.decodeSync(EntityCountSchema)(value),
  createEntityCapacity: (value: number): EntityCapacity => Schema.decodeSync(EntityCapacitySchema)(value),
  createComponentTypeName: (value: string): ComponentTypeName => Schema.decodeSync(ComponentTypeNameSchema)(value),
  createDeltaTime: (value: number): DeltaTime => Schema.decodeSync(DeltaTimeSchema)(value),
  createVector3D: (x: number, y: number, z: number): Vector3D => Schema.decodeSync(Vector3Schema)({ x, y, z }),
  createBlockPosition: (x: number, y: number, z: number): BlockPosition =>
    Schema.decodeSync(BlockPositionSchema)({ x, y, z }),
  createRotation: (pitch: number, yaw: number, roll: number = 0): Rotation =>
    Schema.decodeSync(RotationSchema)({ pitch, yaw, roll }),
} as const

export type BrandedTypesHelper = typeof BrandedTypes
