import { Schema } from 'effect'
import { EntityIdSchema, EntityStatusSchema, EntityTypeSchema, PlayerIdSchema, Vector3Schema } from './index'

const timestamp = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.annotations({
    identifier: 'Timestamp',
  })
)

export const EntityValidationErrorSchema = Schema.TaggedStruct('EntityValidationError', {
  entityId: Schema.optional(EntityIdSchema),
  field: Schema.String,
  message: Schema.String,
  details: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  timestamp,
})
export type EntityValidationError = Schema.Schema.Type<typeof EntityValidationErrorSchema>

export const EntityUpdateErrorSchema = Schema.TaggedStruct('EntityUpdateError', {
  entityId: EntityIdSchema,
  attemptedStatus: Schema.optional(EntityStatusSchema),
  attemptedType: Schema.optional(EntityTypeSchema),
  reason: Schema.String,
  timestamp,
})
export type EntityUpdateError = Schema.Schema.Type<typeof EntityUpdateErrorSchema>

export const EntityNotFoundErrorSchema = Schema.TaggedStruct('EntityNotFoundError', {
  entityId: EntityIdSchema,
  context: Schema.optional(Schema.String),
  searchedAt: timestamp,
})
export type EntityNotFoundError = Schema.Schema.Type<typeof EntityNotFoundErrorSchema>

export const EntitySpawnErrorSchema = Schema.TaggedStruct('EntitySpawnError', {
  entityType: EntityTypeSchema,
  spawnPosition: Vector3Schema,
  reason: Schema.String,
  blockingPlayer: Schema.optional(PlayerIdSchema),
  timestamp,
})
export type EntitySpawnError = Schema.Schema.Type<typeof EntitySpawnErrorSchema>

export const EntityCollisionErrorSchema = Schema.TaggedStruct('EntityCollisionError', {
  entityId: EntityIdSchema,
  collisionPoint: Vector3Schema,
  collidedWith: Schema.optional(EntityIdSchema),
  collisionNormal: Vector3Schema,
  reason: Schema.String,
  timestamp,
})
export type EntityCollisionError = Schema.Schema.Type<typeof EntityCollisionErrorSchema>

export const EntityDomainErrorSchema = Schema.Union(
  EntityValidationErrorSchema,
  EntityUpdateErrorSchema,
  EntityNotFoundErrorSchema,
  EntitySpawnErrorSchema,
  EntityCollisionErrorSchema
)
export type EntityDomainError = Schema.Schema.Type<typeof EntityDomainErrorSchema>

export const makeEntityValidationError = (input: Schema.Schema.Type<typeof EntityValidationErrorSchema>) =>
  Schema.decodeSync(EntityValidationErrorSchema)({ _tag: 'EntityValidationError', ...input })

export const makeEntityUpdateError = (input: Schema.Schema.Type<typeof EntityUpdateErrorSchema>) =>
  Schema.decodeSync(EntityUpdateErrorSchema)({ _tag: 'EntityUpdateError', ...input })

export const makeEntityNotFoundError = (input: Schema.Schema.Type<typeof EntityNotFoundErrorSchema>) =>
  Schema.decodeSync(EntityNotFoundErrorSchema)({ _tag: 'EntityNotFoundError', ...input })

export const makeEntitySpawnError = (input: Schema.Schema.Type<typeof EntitySpawnErrorSchema>) =>
  Schema.decodeSync(EntitySpawnErrorSchema)({ _tag: 'EntitySpawnError', ...input })

export const makeEntityCollisionError = (input: Schema.Schema.Type<typeof EntityCollisionErrorSchema>) =>
  Schema.decodeSync(EntityCollisionErrorSchema)({ _tag: 'EntityCollisionError', ...input })

export const EntityErrorGuards = {
  isDomainError: Schema.is(EntityDomainErrorSchema),
  isValidationError: Schema.is(EntityValidationErrorSchema),
  isUpdateError: Schema.is(EntityUpdateErrorSchema),
  isNotFoundError: Schema.is(EntityNotFoundErrorSchema),
  isSpawnError: Schema.is(EntitySpawnErrorSchema),
  isCollisionError: Schema.is(EntityCollisionErrorSchema),
} as const
