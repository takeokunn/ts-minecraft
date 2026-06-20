import { Schema } from 'effect'
import { PositionSchema, type Position } from '@ts-minecraft/core'
import { Vector3Schema, QuaternionSchema, identity, zero, type Quaternion, type Vector3 } from '@ts-minecraft/core'

export const EntityIdSchema = Schema.String.pipe(Schema.brand('EntityId'))
export type EntityId = Schema.Schema.Type<typeof EntityIdSchema>
export const EntityId = {
  make: (value: string): EntityId => Schema.decodeUnknownSync(EntityIdSchema)(value),
}

export const EntityTypeSchema = Schema.Literal(
  'Zombie',
  'Cow',
  'Pig',
  'Sheep',
  'Chicken',
  'Bat',
  'Bee',
  'Squid',
  'GlowSquid',
  'Witch',
  'Drowned',
  'ZombieVillager',
  'Creeper',
  'Skeleton',
  'Spider',
  'Enderman',
  'EnderDragon',
  'Shulker',
  'Endermite'
)
const ActiveEntityTypeSchema = Schema.Literal(
  'Zombie',
  'Cow',
  'Pig',
  'Sheep',
  'Chicken',
  'Bat',
  'Bee',
  'Squid',
  'GlowSquid',
  'Witch',
  'Drowned',
  'ZombieVillager',
  'Creeper',
  'Skeleton',
  'Spider',
  'Enderman',
  'EnderDragon',
  'Endermite'
)
export type EntityType = Schema.Schema.Type<typeof ActiveEntityTypeSchema>
export const EntityType = {
  Zombie: 'Zombie' as const,
  Cow: 'Cow' as const,
  Pig: 'Pig' as const,
  Sheep: 'Sheep' as const,
  Chicken: 'Chicken' as const,
  Bat: 'Bat' as const,
  Bee: 'Bee' as const,
  Squid: 'Squid' as const,
  GlowSquid: 'GlowSquid' as const,
  Witch: 'Witch' as const,
  Drowned: 'Drowned' as const,
  ZombieVillager: 'ZombieVillager' as const,
  Creeper: 'Creeper' as const,
  Skeleton: 'Skeleton' as const,
  Spider: 'Spider' as const,
  Enderman: 'Enderman' as const,
  EnderDragon: 'EnderDragon' as const,
  Shulker: 'Shulker' as const,
  Endermite: 'Endermite' as const,
}

export const MobBehaviorSchema = Schema.Literal('hostile', 'passive')
export type MobBehavior = Schema.Schema.Type<typeof MobBehaviorSchema>

export const EntitySchema = Schema.Struct({
  entityId: EntityIdSchema,
  position: PositionSchema,
  velocity: Vector3Schema,
  rotation: QuaternionSchema,
  health: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  type: ActiveEntityTypeSchema,
  // R6d: true while the mob is a baby (ageTicks < BABY_GROW_TICKS); the renderer
  // draws it at reduced scale. Optional because non-mob entities do not age.
  isBaby: Schema.optional(Schema.Boolean),
  // Creeper-only public fuse progress for the renderer flash. Optional keeps
  // non-creeper/test entity construction compact.
  fuseSecs: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.nonNegative())),
  // Public burning duration used by renderers/UI that need to show fire effects.
  fireSecs: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.nonNegative())),
})
export type Entity = Schema.Schema.Type<typeof EntitySchema>

export const createEntity = (params: {
  readonly entityId: EntityId
  readonly position: Position
  readonly type: EntityType
  readonly health: number
  readonly velocity?: Vector3
  readonly rotation?: Quaternion
}): Entity => ({
  entityId: params.entityId,
  position: params.position,
  velocity: params.velocity ?? zero,
  rotation: params.rotation ?? identity,
  health: params.health,
  type: params.type,
})
