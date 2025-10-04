import { Schema } from 'effect'
import { EntityIdSchema, PlayerIdSchema, Vector3Schema } from './core'
import { EntityStatusSchema, EntityTypeSchema } from './constants'

const baseEventFields = {
  eventId: Schema.String.pipe(Schema.minLength(1)),
  occurredAt: Schema.Number.pipe(Schema.nonNegative()),
  source: Schema.optional(Schema.String),
}

export const EntitySpawnedEventSchema = Schema.TaggedStruct('EntitySpawnedEvent', {
  ...baseEventFields,
  entityId: EntityIdSchema,
  entityType: EntityTypeSchema,
  spawnPosition: Vector3Schema,
  spawnedBy: Schema.optional(PlayerIdSchema),
})
export type EntitySpawnedEvent = Schema.Schema.Type<typeof EntitySpawnedEventSchema>

export const EntityUpdatedEventSchema = Schema.TaggedStruct('EntityUpdatedEvent', {
  ...baseEventFields,
  entityId: EntityIdSchema,
  newStatus: Schema.optional(EntityStatusSchema),
  newType: Schema.optional(EntityTypeSchema),
  position: Schema.optional(Vector3Schema),
  velocity: Schema.optional(Vector3Schema),
})
export type EntityUpdatedEvent = Schema.Schema.Type<typeof EntityUpdatedEventSchema>

export const EntityDespawnedEventSchema = Schema.TaggedStruct('EntityDespawnedEvent', {
  ...baseEventFields,
  entityId: EntityIdSchema,
  entityType: EntityTypeSchema,
  lastPosition: Vector3Schema,
  reason: Schema.String,
})
export type EntityDespawnedEvent = Schema.Schema.Type<typeof EntityDespawnedEventSchema>

export const EntityEventSchema = Schema.Union(
  EntitySpawnedEventSchema,
  EntityUpdatedEventSchema,
  EntityDespawnedEventSchema
)
export type EntityEvent = Schema.Schema.Type<typeof EntityEventSchema>

export const makeEntitySpawnedEvent = (input: Schema.Schema.Type<typeof EntitySpawnedEventSchema>) =>
  Schema.decodeSync(EntitySpawnedEventSchema)({ _tag: 'EntitySpawnedEvent', ...input })

export const makeEntityUpdatedEvent = (input: Schema.Schema.Type<typeof EntityUpdatedEventSchema>) =>
  Schema.decodeSync(EntityUpdatedEventSchema)({ _tag: 'EntityUpdatedEvent', ...input })

export const makeEntityDespawnedEvent = (input: Schema.Schema.Type<typeof EntityDespawnedEventSchema>) =>
  Schema.decodeSync(EntityDespawnedEventSchema)({ _tag: 'EntityDespawnedEvent', ...input })
