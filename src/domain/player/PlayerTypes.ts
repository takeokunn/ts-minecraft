import { Schema, Brand, Data } from 'effect'
import type * as Types from 'effect/Types'

// =========================================
// Branded Types & Opaque Types
// =========================================

export const PlayerId = Schema.String.pipe(
  Schema.brand('PlayerId'),
  Schema.annotations({
    title: 'PlayerId',
    description: 'プレイヤーの一意識別子',
  })
)
export type PlayerId = Schema.Schema.Type<typeof PlayerId>

export const EntityId = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand('EntityId'),
  Schema.annotations({ title: 'EntityId' })
)
export type EntityId = Schema.Schema.Type<typeof EntityId>

export const Health = Schema.Number.pipe(Schema.between(0, 20), Schema.brand('Health'))
export type Health = Schema.Schema.Type<typeof Health>

export const Hunger = Schema.Number.pipe(Schema.between(0, 20), Schema.brand('Hunger'))
export type Hunger = Schema.Schema.Type<typeof Hunger>

export const Experience = Schema.Number.pipe(Schema.nonNegative(), Schema.int(), Schema.brand('Experience'))
export type Experience = Schema.Schema.Type<typeof Experience>

// =========================================
// Vector & Spatial Types
// =========================================

export const Vector3D = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
export interface Vector3D extends Schema.Schema.Type<typeof Vector3D> {}

export const Rotation = Schema.Struct({
  pitch: Schema.Number.pipe(Schema.between(-90, 90)),
  yaw: Schema.Number.pipe(Schema.between(-180, 180)),
  roll: Schema.Number,
})
export interface Rotation extends Schema.Schema.Type<typeof Rotation> {}

export const Velocity = Vector3D.pipe(Schema.brand('Velocity'), Schema.annotations({ title: 'Velocity' }))
export interface Velocity extends Schema.Schema.Type<typeof Velocity> {}

// =========================================
// Game Types
// =========================================

export const GameMode = Schema.Literal('survival', 'creative', 'adventure', 'spectator')
export type GameMode = Schema.Schema.Type<typeof GameMode>

export const BlockFace = Schema.Literal('top', 'bottom', 'north', 'south', 'east', 'west')
export type BlockFace = Schema.Schema.Type<typeof BlockFace>

// =========================================
// Player Components (Pure Data)
// =========================================

export const PlayerStats = Schema.Struct({
  health: Health,
  maxHealth: Health,
  hunger: Hunger,
  saturation: Hunger,
  experience: Experience,
  level: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  armor: Schema.Number.pipe(Schema.between(0, 20)),
}).pipe(Schema.annotations({ identifier: 'PlayerStats' }))
export interface PlayerStats extends Schema.Schema.Type<typeof PlayerStats> {}

export const PlayerAbilities = Schema.Struct({
  canFly: Schema.Boolean,
  isFlying: Schema.Boolean,
  canBreakBlocks: Schema.Boolean,
  canPlaceBlocks: Schema.Boolean,
  invulnerable: Schema.Boolean,
  walkSpeed: Schema.Number.pipe(Schema.positive()),
  flySpeed: Schema.Number.pipe(Schema.positive()),
}).pipe(Schema.annotations({ identifier: 'PlayerAbilities' }))
export interface PlayerAbilities extends Schema.Schema.Type<typeof PlayerAbilities> {}

// =========================================
// Inventory & Equipment
// =========================================

export const ItemStack = Schema.Struct({
  itemId: Schema.String,
  count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface ItemStack extends Schema.Schema.Type<typeof ItemStack> {}

export const Inventory = Schema.Struct({
  slots: Schema.Array(Schema.NullOr(ItemStack)).pipe(Schema.itemsCount(36)),
  selectedSlot: Schema.Number.pipe(Schema.int(), Schema.between(0, 8)),
})
export interface Inventory extends Schema.Schema.Type<typeof Inventory> {}

export const Equipment = Schema.Struct({
  helmet: Schema.NullOr(ItemStack),
  chestplate: Schema.NullOr(ItemStack),
  leggings: Schema.NullOr(ItemStack),
  boots: Schema.NullOr(ItemStack),
  mainHand: Schema.NullOr(ItemStack),
  offHand: Schema.NullOr(ItemStack),
})
export interface Equipment extends Schema.Schema.Type<typeof Equipment> {}

// =========================================
// Player Entity (Aggregate Root)
// =========================================

export const Player = Schema.Struct({
  id: PlayerId,
  entityId: EntityId,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(16), Schema.pattern(/^[a-zA-Z0-9_]+$/)),
  position: Vector3D,
  rotation: Rotation,
  velocity: Velocity,
  stats: PlayerStats,
  gameMode: GameMode,
  abilities: PlayerAbilities,
  inventory: Inventory,
  equipment: Equipment,
  isOnGround: Schema.Boolean,
  isSneaking: Schema.Boolean,
  isSprinting: Schema.Boolean,
  lastUpdate: Schema.Number.pipe(Schema.int()),
  createdAt: Schema.Number.pipe(Schema.int()),
}).pipe(
  Schema.annotations({
    identifier: 'Player',
    title: 'Player Entity',
    description: 'プレイヤーエンティティのアグリゲートルート',
  })
)
export interface Player extends Schema.Schema.Type<typeof Player> {}

// =========================================
// Player Actions (Tagged Unions)
// =========================================

export const PlayerAction = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Move'),
    direction: Schema.Struct({
      forward: Schema.Boolean,
      backward: Schema.Boolean,
      left: Schema.Boolean,
      right: Schema.Boolean,
      jump: Schema.Boolean,
      sneak: Schema.Boolean,
      sprint: Schema.Boolean,
    }),
  }),

  Schema.Struct({
    _tag: Schema.Literal('Jump'),
  }),

  Schema.Struct({
    _tag: Schema.Literal('Attack'),
    targetId: EntityId,
  }),

  Schema.Struct({
    _tag: Schema.Literal('UseItem'),
    slotIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 35)),
    target: Schema.optional(Vector3D),
  }),

  Schema.Struct({
    _tag: Schema.Literal('PlaceBlock'),
    position: Vector3D,
    face: BlockFace,
  }),

  Schema.Struct({
    _tag: Schema.Literal('BreakBlock'),
    position: Vector3D,
  }),

  Schema.Struct({
    _tag: Schema.Literal('OpenContainer'),
    position: Vector3D,
  }),

  Schema.Struct({
    _tag: Schema.Literal('DropItem'),
    slotIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 35)),
    count: Schema.Number.pipe(Schema.int(), Schema.positive()),
  })
)
export type PlayerAction = Schema.Schema.Type<typeof PlayerAction>

// =========================================
// Damage Sources (Tagged Unions)
// =========================================

export const DamageSource = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Fall'),
    distance: Schema.Number.pipe(Schema.positive()),
  }),

  Schema.Struct({
    _tag: Schema.Literal('Entity'),
    entityId: EntityId,
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

// =========================================
// Player Events (Event Sourcing)
// =========================================

export const PlayerEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('PlayerCreated'),
    playerId: PlayerId,
    name: Schema.String,
    position: Vector3D,
    gameMode: GameMode,
    timestamp: Schema.Number,
  }),

  Schema.Struct({
    _tag: Schema.Literal('PlayerMoved'),
    playerId: PlayerId,
    from: Vector3D,
    to: Vector3D,
    timestamp: Schema.Number,
  }),

  Schema.Struct({
    _tag: Schema.Literal('PlayerDamaged'),
    playerId: PlayerId,
    damage: Schema.Number,
    source: DamageSource,
    newHealth: Health,
    timestamp: Schema.Number,
  }),

  Schema.Struct({
    _tag: Schema.Literal('PlayerDied'),
    playerId: PlayerId,
    cause: DamageSource,
    position: Vector3D,
    timestamp: Schema.Number,
  }),

  Schema.Struct({
    _tag: Schema.Literal('PlayerRespawned'),
    playerId: PlayerId,
    position: Vector3D,
    timestamp: Schema.Number,
  }),

  Schema.Struct({
    _tag: Schema.Literal('ItemPickedUp'),
    playerId: PlayerId,
    item: ItemStack,
    timestamp: Schema.Number,
  }),

  Schema.Struct({
    _tag: Schema.Literal('ItemDropped'),
    playerId: PlayerId,
    item: ItemStack,
    position: Vector3D,
    timestamp: Schema.Number,
  })
)
export type PlayerEvent = Schema.Schema.Type<typeof PlayerEvent>

// =========================================
// Errors (Data.TaggedError)
// =========================================

export const PlayerErrorReason = Schema.Literal(
  'PlayerNotFound',
  'PlayerAlreadyExists',
  'InvalidPosition',
  'InvalidHealth',
  'InvalidGameMode',
  'InventoryFull',
  'ItemNotFound',
  'PermissionDenied',
  'ValidationFailed'
)
export type PlayerErrorReason = Schema.Schema.Type<typeof PlayerErrorReason>

export const PlayerError = Schema.TaggedStruct('PlayerError', {
  reason: PlayerErrorReason,
  playerId: Schema.optional(PlayerId),
  message: Schema.String,
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface PlayerError extends Schema.Schema.Type<typeof PlayerError> {}

// =========================================
// Helper Functions (Pure)
// =========================================

export const makePlayerId = (id: string): PlayerId => Schema.decodeSync(PlayerId)(id)

export const makeEntityId = (id: number): EntityId => Schema.decodeSync(EntityId)(id)

export const makeHealth = (value: number): Health => Schema.decodeSync(Health)(value)

export const makeHunger = (value: number): Hunger => Schema.decodeSync(Hunger)(value)

export const makeExperience = (value: number): Experience => Schema.decodeSync(Experience)(value)

// =========================================
// Default Values
// =========================================

export const defaultPlayerStats: PlayerStats = {
  health: makeHealth(20),
  maxHealth: makeHealth(20),
  hunger: makeHunger(20),
  saturation: makeHunger(20),
  experience: makeExperience(0),
  level: 0,
  armor: 0,
}

export const defaultPlayerAbilities: PlayerAbilities = {
  canFly: false,
  isFlying: false,
  canBreakBlocks: true,
  canPlaceBlocks: true,
  invulnerable: false,
  walkSpeed: 4.317,
  flySpeed: 10.92,
}

export const defaultInventory: Inventory = {
  slots: Array(36).fill(null),
  selectedSlot: 0,
}

export const defaultEquipment: Equipment = {
  helmet: null,
  chestplate: null,
  leggings: null,
  boots: null,
  mainHand: null,
  offHand: null,
}
