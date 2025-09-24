import { Schema, Brand, Data } from 'effect'
import type * as Types from 'effect/Types'

// =========================================
// Branded Types & Opaque Types
// =========================================

export const PlayerId = Schema.String.pipe(
  Schema.brand('PlayerId'),
  Schema.annotations({
    title: 'PlayerId',
    description: 'プレイヤーの一意識別子'
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

export const Health = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.brand('Health')
)
export type Health = Schema.Schema.Type<typeof Health>

export const Hunger = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.brand('Hunger')
)
export type Hunger = Schema.Schema.Type<typeof Hunger>

export const Experience = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.int(),
  Schema.brand('Experience')
)
export type Experience = Schema.Schema.Type<typeof Experience>

// =========================================
// Vector & Spatial Types
// =========================================

export const Vector3D = Schema.Struct({
  readonly x: Schema.Number,
  readonly y: Schema.Number,
  readonly z: Schema.Number
})
export interface Vector3D extends Schema.Schema.Type<typeof Vector3D> {}

export const Rotation = Schema.Struct({
  readonly pitch: Schema.Number.pipe(Schema.between(-90, 90)),
  readonly yaw: Schema.Number.pipe(Schema.between(-180, 180)),
  readonly roll: Schema.Number
})
export interface Rotation extends Schema.Schema.Type<typeof Rotation> {}

export const Velocity = Vector3D.pipe(
  Schema.brand('Velocity'),
  Schema.annotations({ title: 'Velocity' })
)
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
  readonly health: Health,
  readonly maxHealth: Health,
  readonly hunger: Hunger,
  readonly saturation: Hunger,
  readonly experience: Experience,
  readonly level: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  readonly armor: Schema.Number.pipe(Schema.between(0, 20))
}).pipe(
  Schema.annotations({ identifier: 'PlayerStats' })
)
export interface PlayerStats extends Schema.Schema.Type<typeof PlayerStats> {}

export const PlayerAbilities = Schema.Struct({
  readonly canFly: Schema.Boolean,
  readonly isFlying: Schema.Boolean,
  readonly canBreakBlocks: Schema.Boolean,
  readonly canPlaceBlocks: Schema.Boolean,
  readonly invulnerable: Schema.Boolean,
  readonly walkSpeed: Schema.Number.pipe(Schema.positive()),
  readonly flySpeed: Schema.Number.pipe(Schema.positive())
}).pipe(
  Schema.annotations({ identifier: 'PlayerAbilities' })
)
export interface PlayerAbilities extends Schema.Schema.Type<typeof PlayerAbilities> {}

// =========================================
// Inventory & Equipment
// =========================================

export const ItemStack = Schema.Struct({
  readonly itemId: Schema.String,
  readonly count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
  readonly metadata: Schema.optional(
    Schema.HashMap(Schema.String, Schema.Unknown)
  )
})
export interface ItemStack extends Schema.Schema.Type<typeof ItemStack> {}

export const Inventory = Schema.Struct({
  readonly slots: Schema.Array(
    Schema.NullOr(ItemStack)
  ).pipe(Schema.itemsCount(36)),
  readonly selectedSlot: Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, 8)
  )
})
export interface Inventory extends Schema.Schema.Type<typeof Inventory> {}

export const Equipment = Schema.Struct({
  readonly helmet: Schema.NullOr(ItemStack),
  readonly chestplate: Schema.NullOr(ItemStack),
  readonly leggings: Schema.NullOr(ItemStack),
  readonly boots: Schema.NullOr(ItemStack),
  readonly mainHand: Schema.NullOr(ItemStack),
  readonly offHand: Schema.NullOr(ItemStack)
})
export interface Equipment extends Schema.Schema.Type<typeof Equipment> {}

// =========================================
// Player Entity (Aggregate Root)
// =========================================

export const Player = Schema.Struct({
  readonly id: PlayerId,
  readonly entityId: EntityId,
  readonly name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(16),
    Schema.pattern(/^[a-zA-Z0-9_]+$/)
  ),
  readonly position: Vector3D,
  readonly rotation: Rotation,
  readonly velocity: Velocity,
  readonly stats: PlayerStats,
  readonly gameMode: GameMode,
  readonly abilities: PlayerAbilities,
  readonly inventory: Inventory,
  readonly equipment: Equipment,
  readonly isOnGround: Schema.Boolean,
  readonly isSneaking: Schema.Boolean,
  readonly isSprinting: Schema.Boolean,
  readonly lastUpdate: Schema.Number.pipe(Schema.int()),
  readonly createdAt: Schema.Number.pipe(Schema.int())
}).pipe(
  Schema.annotations({
    identifier: 'Player',
    title: 'Player Entity',
    description: 'プレイヤーエンティティのアグリゲートルート'
  })
)
export interface Player extends Schema.Schema.Type<typeof Player> {}

// =========================================
// Player Actions (Tagged Unions)
// =========================================

export const PlayerAction = Schema.TaggedUnion('_tag', {
  Move: Schema.Struct({
    _tag: Schema.Literal('Move'),
    direction: Schema.Struct({
      readonly forward: Schema.Boolean,
      readonly backward: Schema.Boolean,
      readonly left: Schema.Boolean,
      readonly right: Schema.Boolean,
      readonly jump: Schema.Boolean,
      readonly sneak: Schema.Boolean,
      readonly sprint: Schema.Boolean
    })
  }),

  Jump: Schema.Struct({
    _tag: Schema.Literal('Jump')
  }),

  Attack: Schema.Struct({
    _tag: Schema.Literal('Attack'),
    targetId: EntityId
  }),

  UseItem: Schema.Struct({
    _tag: Schema.Literal('UseItem'),
    slotIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 35)),
    target: Schema.optional(Vector3D)
  }),

  PlaceBlock: Schema.Struct({
    _tag: Schema.Literal('PlaceBlock'),
    position: Vector3D,
    face: BlockFace
  }),

  BreakBlock: Schema.Struct({
    _tag: Schema.Literal('BreakBlock'),
    position: Vector3D
  }),

  OpenContainer: Schema.Struct({
    _tag: Schema.Literal('OpenContainer'),
    position: Vector3D
  }),

  DropItem: Schema.Struct({
    _tag: Schema.Literal('DropItem'),
    slotIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 35)),
    count: Schema.Number.pipe(Schema.int(), Schema.positive())
  })
})
export type PlayerAction = Schema.Schema.Type<typeof PlayerAction>

// =========================================
// Damage Sources (Tagged Unions)
// =========================================

export const DamageSource = Schema.TaggedUnion('_tag', {
  Fall: Schema.Struct({
    _tag: Schema.Literal('Fall'),
    distance: Schema.Number.pipe(Schema.positive())
  }),

  Entity: Schema.Struct({
    _tag: Schema.Literal('Entity'),
    entityId: EntityId,
    damage: Schema.Number.pipe(Schema.positive())
  }),

  Environment: Schema.Struct({
    _tag: Schema.Literal('Environment'),
    type: Schema.Literal('lava', 'drowning', 'suffocation', 'void', 'fire')
  }),

  Hunger: Schema.Struct({
    _tag: Schema.Literal('Hunger')
  })
})
export type DamageSource = Schema.Schema.Type<typeof DamageSource>

// =========================================
// Player Events (Event Sourcing)
// =========================================

export const PlayerEvent = Schema.TaggedUnion('_tag', {
  PlayerCreated: Schema.Struct({
    _tag: Schema.Literal('PlayerCreated'),
    playerId: PlayerId,
    name: Schema.String,
    position: Vector3D,
    gameMode: GameMode,
    timestamp: Schema.Number
  }),

  PlayerMoved: Schema.Struct({
    _tag: Schema.Literal('PlayerMoved'),
    playerId: PlayerId,
    from: Vector3D,
    to: Vector3D,
    timestamp: Schema.Number
  }),

  PlayerDamaged: Schema.Struct({
    _tag: Schema.Literal('PlayerDamaged'),
    playerId: PlayerId,
    damage: Schema.Number,
    source: DamageSource,
    newHealth: Health,
    timestamp: Schema.Number
  }),

  PlayerDied: Schema.Struct({
    _tag: Schema.Literal('PlayerDied'),
    playerId: PlayerId,
    cause: DamageSource,
    position: Vector3D,
    timestamp: Schema.Number
  }),

  PlayerRespawned: Schema.Struct({
    _tag: Schema.Literal('PlayerRespawned'),
    playerId: PlayerId,
    position: Vector3D,
    timestamp: Schema.Number
  }),

  ItemPickedUp: Schema.Struct({
    _tag: Schema.Literal('ItemPickedUp'),
    playerId: PlayerId,
    item: ItemStack,
    timestamp: Schema.Number
  }),

  ItemDropped: Schema.Struct({
    _tag: Schema.Literal('ItemDropped'),
    playerId: PlayerId,
    item: ItemStack,
    position: Vector3D,
    timestamp: Schema.Number
  })
})
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
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})
export interface PlayerError extends Schema.Schema.Type<typeof PlayerError> {}

// =========================================
// Helper Functions (Pure)
// =========================================

export const makePlayerId = (id: string): PlayerId =>
  Schema.decodeSync(PlayerId)(id)

export const makeEntityId = (id: number): EntityId =>
  Schema.decodeSync(EntityId)(id)

export const makeHealth = (value: number): Health =>
  Schema.decodeSync(Health)(value)

export const makeHunger = (value: number): Hunger =>
  Schema.decodeSync(Hunger)(value)

export const makeExperience = (value: number): Experience =>
  Schema.decodeSync(Experience)(value)

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
  armor: 0
}

export const defaultPlayerAbilities: PlayerAbilities = {
  canFly: false,
  isFlying: false,
  canBreakBlocks: true,
  canPlaceBlocks: true,
  invulnerable: false,
  walkSpeed: 4.317,
  flySpeed: 10.92
}

export const defaultInventory: Inventory = {
  slots: Array(36).fill(null),
  selectedSlot: 0
}

export const defaultEquipment: Equipment = {
  helmet: null,
  chestplate: null,
  leggings: null,
  boots: null,
  mainHand: null,
  offHand: null
}