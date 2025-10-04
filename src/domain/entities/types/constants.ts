import { Schema } from 'effect'

export const ENTITY_TYPES = {
  PLAYER: 'player',
  MOB: 'mob',
  NPC: 'npc',
  ITEM: 'item',
  PROJECTILE: 'projectile',
  VEHICLE: 'vehicle',
  EFFECT: 'effect',
  DECORATION: 'decoration',
} as const

export const EntityTypeSchema = Schema.Literal(
  ENTITY_TYPES.PLAYER,
  ENTITY_TYPES.MOB,
  ENTITY_TYPES.NPC,
  ENTITY_TYPES.ITEM,
  ENTITY_TYPES.PROJECTILE,
  ENTITY_TYPES.VEHICLE,
  ENTITY_TYPES.EFFECT,
  ENTITY_TYPES.DECORATION
).pipe(
  Schema.annotations({
    title: 'EntityType',
    description: 'High level entity category',
  })
)
export type EntityType = Schema.Schema.Type<typeof EntityTypeSchema>

export const ENTITY_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  DELETED: 'deleted',
  LOADING: 'loading',
  ERROR: 'error',
} as const

export const EntityStatusSchema = Schema.Literal(
  ENTITY_STATUS.ACTIVE,
  ENTITY_STATUS.INACTIVE,
  ENTITY_STATUS.PENDING,
  ENTITY_STATUS.DELETED,
  ENTITY_STATUS.LOADING,
  ENTITY_STATUS.ERROR
).pipe(
  Schema.annotations({
    title: 'EntityStatus',
    description: 'Lifecycle flag for managed entities',
  })
)
export type EntityStatus = Schema.Schema.Type<typeof EntityStatusSchema>

export const ENTITY_PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  MINIMAL: 'minimal',
} as const

export const EntityPrioritySchema = Schema.Literal(
  ENTITY_PRIORITY.HIGH,
  ENTITY_PRIORITY.MEDIUM,
  ENTITY_PRIORITY.LOW,
  ENTITY_PRIORITY.MINIMAL
).pipe(
  Schema.annotations({
    title: 'EntityPriority',
    description: 'Scheduling priority for entity updates',
  })
)
export type EntityPriority = Schema.Schema.Type<typeof EntityPrioritySchema>

export const ENTITY_CAPABILITIES = {
  CAN_MOVE: 'can_move',
  CAN_ATTACK: 'can_attack',
  CAN_TAKE_DAMAGE: 'can_take_damage',
  CAN_BREAK_BLOCKS: 'can_break_blocks',
  CAN_PLACE_BLOCKS: 'can_place_blocks',
  CAN_USE_INVENTORY: 'can_use_inventory',
  CAN_CHAT: 'can_chat',
  CAN_FLY: 'can_fly',
  CAN_BREATHE_UNDERWATER: 'can_breathe_underwater',
  CAN_BE_INVULNERABLE: 'can_be_invulnerable',
} as const

export const EntityCapabilitySchema = Schema.Literal(
  ENTITY_CAPABILITIES.CAN_MOVE,
  ENTITY_CAPABILITIES.CAN_ATTACK,
  ENTITY_CAPABILITIES.CAN_TAKE_DAMAGE,
  ENTITY_CAPABILITIES.CAN_BREAK_BLOCKS,
  ENTITY_CAPABILITIES.CAN_PLACE_BLOCKS,
  ENTITY_CAPABILITIES.CAN_USE_INVENTORY,
  ENTITY_CAPABILITIES.CAN_CHAT,
  ENTITY_CAPABILITIES.CAN_FLY,
  ENTITY_CAPABILITIES.CAN_BREATHE_UNDERWATER,
  ENTITY_CAPABILITIES.CAN_BE_INVULNERABLE
).pipe(
  Schema.annotations({
    title: 'EntityCapability',
    description: 'Capability flags assignable to entities',
  })
)
export type EntityCapability = Schema.Schema.Type<typeof EntityCapabilitySchema>
