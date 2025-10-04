import { Schema } from '@effect/schema'
import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Effect, Match } from 'effect'
import * as Either from 'effect/Either'
import { pipe } from 'effect/Function'
import * as Option from 'effect/Option'
import {
  ENTITY_PRIORITY,
  ENTITY_STATUS,
  EntityPrioritySchema,
  EntityStatusSchema,
  EntityType,
  EntityTypeSchema,
} from '../types/constants'
import {
  BrandedTypes,
  DeltaTimeSchema,
  EntityId,
  EntityIdSchema,
  Rotation,
  RotationSchema,
  Vector3D,
  Vector3Schema,
  Velocity,
  VelocitySchema,
} from '../types/core'
import {
  EntityCollisionError,
  EntityDomainError,
  EntityNotFoundError,
  EntityUpdateError,
  EntityValidationError,
  makeEntityCollisionError,
  makeEntityNotFoundError,
  makeEntityUpdateError,
  makeEntityValidationError,
} from '../types/errors'
import { EntityEvent, makeEntityDespawnedEvent, makeEntitySpawnedEvent, makeEntityUpdatedEvent } from '../types/events'

interface EntityCoreState {
  readonly id: EntityId
  readonly type: EntityType
  readonly status: keyof typeof ENTITY_STATUS
  readonly priority: Schema.Schema.Type<typeof EntityPrioritySchema>
  readonly position: Vector3D
  readonly rotation: Rotation
  readonly velocity: Velocity
  readonly tags: ReadonlyArray<string>
  readonly createdAt: number
  readonly updatedAt: number
  readonly version: number
  readonly events: ReadonlyArray<EntityEvent>
}

const defaultRotation: Rotation = BrandedTypes.createRotation(0, 0, 0)
const defaultVelocity: Velocity = { x: 0, y: 0, z: 0 }

const EntityCreateSchema = Schema.Struct({
  id: EntityIdSchema,
  type: EntityTypeSchema,
  status: Schema.optional(EntityStatusSchema),
  priority: Schema.optional(EntityPrioritySchema),
  position: Vector3Schema,
  rotation: Schema.optional(RotationSchema),
  velocity: Schema.optional(VelocitySchema),
  tags: Schema.optional(Schema.Array(Schema.String)),
}).pipe(
  Schema.annotations({
    title: 'EntityCreateInput',
    description: 'Payload required to instantiate an entity state',
  })
)
export type EntityCreateInput = Schema.Schema.Type<typeof EntityCreateSchema>

const EntityUpdateSchema = Schema.Struct({
  position: Schema.optional(Vector3Schema),
  rotation: Schema.optional(RotationSchema),
  velocity: Schema.optional(VelocitySchema),
  status: Schema.optional(EntityStatusSchema),
  priority: Schema.optional(EntityPrioritySchema),
  tags: Schema.optional(Schema.Array(Schema.String)),
}).pipe(
  Schema.annotations({
    title: 'EntityUpdateInput',
    description: 'Patch payload applied to an entity state',
  })
)
export type EntityUpdateInput = Schema.Schema.Type<typeof EntityUpdateSchema>

const EntityTickSchema = Schema.Struct({
  deltaTime: DeltaTimeSchema,
  displacement: Schema.optional(Vector3Schema),
}).pipe(
  Schema.annotations({
    title: 'EntityTickInput',
    description: 'Simulation tick payload',
  })
)
export type EntityTickInput = Schema.Schema.Type<typeof EntityTickSchema>

export type EntityState = EntityCoreState

const decodeOrValidationError =
  <A>(schema: Schema.Schema<A>, transform: (message: string) => EntityValidationError) =>
  (input: unknown) =>
    pipe(
      Schema.decodeUnknownEither(schema)(input),
      Either.match({
        onLeft: (error) => Effect.fail(transform(TreeFormatter.formatErrorSync(error))),
        onRight: Effect.succeed,
      })
    )

export const createEntity = (input: EntityCreateInput): Effect.Effect<EntityState, EntityValidationError> =>
  Effect.gen(function* () {
    const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis)

    const payload = yield* decodeOrValidationError(EntityCreateSchema, (message) =>
      makeEntityValidationError({
        entityId: undefined,
        field: 'createEntity',
        message,
        timestamp: now,
      })
    )(input)

    const rotation = pipe(
      Option.fromNullable(payload.rotation),
      Option.getOrElse(() => defaultRotation)
    )

    const velocity = pipe(
      Option.fromNullable(payload.velocity),
      Option.getOrElse(() => defaultVelocity)
    )

    const spawnEvent = makeEntitySpawnedEvent({
      eventId: `${payload.id}-spawn-${now}`,
      occurredAt: now,
      source: 'entity.create',
      entityId: payload.id,
      entityType: payload.type,
      spawnPosition: payload.position,
      spawnedBy: undefined,
    })

    const status = payload.status ?? ENTITY_STATUS.ACTIVE

    const state: EntityState = {
      id: payload.id,
      type: payload.type,
      status,
      priority: payload.priority ?? ENTITY_PRIORITY.MEDIUM,
      position: payload.position,
      rotation,
      velocity,
      tags: payload.tags ?? [],
      createdAt: now,
      updatedAt: now,
      version: 0,
      events: [spawnEvent],
    }

    return state
  })

export const recordEvent = (state: EntityState, event: EntityEvent): EntityState => ({
  ...state,
  events: [...state.events, event],
})

const applyUpdates = (state: EntityState, update: EntityUpdateInput): Effect.Effect<EntityState, EntityUpdateError> => {
  const collectModifier = <A>(option: Option.Option<A>, mapper: (value: A) => (current: EntityState) => EntityState) =>
    Option.match(option, {
      onNone: () => [] as ReadonlyArray<(current: EntityState) => EntityState>,
      onSome: (value) => [mapper(value)],
    })

  const modifiers = [
    ...collectModifier(Option.fromNullable(update.position), (position) => (current) => ({ ...current, position })),
    ...collectModifier(Option.fromNullable(update.rotation), (rotation) => (current) => ({ ...current, rotation })),
    ...collectModifier(Option.fromNullable(update.velocity), (velocity) => (current) => ({ ...current, velocity })),
    ...collectModifier(Option.fromNullable(update.status), (status) => (current) => ({ ...current, status })),
    ...collectModifier(Option.fromNullable(update.priority), (priority) => (current) => ({ ...current, priority })),
    ...collectModifier(Option.fromNullable(update.tags), (tags) => (current) => ({ ...current, tags })),
  ]

  const hasChanges = modifiers.length > 0

  return pipe(
    hasChanges,
    Match.value,
    Match.when(false, () =>
      Effect.fail(
        makeEntityUpdateError({
          entityId: state.id,
          attemptedStatus: update.status,
          attemptedType: undefined,
          reason: 'No changes provided',
          timestamp: state.updatedAt,
        })
      )
    ),
    Match.orElse(() => Effect.succeed(modifiers.reduce((current, modifier) => modifier(current), state)))
  )
}

export const updateEntity = (
  state: EntityState,
  patch: EntityUpdateInput
): Effect.Effect<EntityState, EntityValidationError | EntityUpdateError> =>
  Effect.gen(function* () {
    const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis)

    const payload = yield* decodeOrValidationError(EntityUpdateSchema, (message) =>
      makeEntityValidationError({
        entityId: state.id,
        field: 'updateEntity',
        message,
        timestamp: now,
      })
    )(patch)

    const mutated = yield* applyUpdates(state, payload)

    const updateEvent = makeEntityUpdatedEvent({
      eventId: `${state.id}-update-${now}`,
      occurredAt: now,
      source: 'entity.update',
      entityId: state.id,
      newStatus: payload.status,
      newType: undefined,
      position: payload.position,
      velocity: payload.velocity,
    })

    return {
      ...mutated,
      updatedAt: now,
      version: mutated.version + 1,
      events: [...mutated.events, updateEvent],
    }
  })

export const markDespawned = (
  state: EntityState,
  reason: string
): Effect.Effect<EntityState, EntityNotFoundError | EntityUpdateError> =>
  Effect.gen(function* () {
    const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis)

    return yield* pipe(
      state.status === ENTITY_STATUS.DELETED,
      Match.value,
      Match.when(true, () =>
        Effect.fail(
          makeEntityNotFoundError({
            entityId: state.id,
            context: 'Entity already despawned',
            searchedAt: now,
          })
        )
      ),
      Match.orElse(() => Effect.succeed(state))
    ).pipe(
      Effect.map((current) => {
        const event = makeEntityDespawnedEvent({
          eventId: `${current.id}-despawn-${now}`,
          occurredAt: now,
          source: 'entity.despawn',
          entityId: current.id,
          entityType: current.type,
          lastPosition: current.position,
          reason,
        })

        return {
          ...current,
          status: ENTITY_STATUS.DELETED,
          updatedAt: now,
          version: current.version + 1,
          events: [...current.events, event],
        }
      })
    )
  })

export const integrateTick = (
  state: EntityState,
  tick: EntityTickInput
): Effect.Effect<EntityState, EntityCollisionError> =>
  Effect.gen(function* () {
    const payload = yield* pipe(
      Schema.decodeUnknownEither(EntityTickSchema)(tick),
      Either.match({
        onLeft: (error) =>
          Effect.fail(
            makeEntityCollisionError({
              entityId: state.id,
              collisionPoint: state.position,
              collidedWith: undefined,
              collisionNormal: { x: 0, y: 1, z: 0 },
              reason: TreeFormatter.formatErrorSync(error),
              timestamp: state.updatedAt,
            })
          ),
        onRight: Effect.succeed,
      })
    )

    const displacement = pipe(
      Option.fromNullable(payload.displacement),
      Option.getOrElse(() => BrandedTypes.createVector3D(0, 0, 0))
    )

    const divisor = Math.max(payload.deltaTime, 1)

    const updatedPosition: Vector3D = {
      x: state.position.x + displacement.x,
      y: state.position.y + displacement.y,
      z: state.position.z + displacement.z,
    }

    const updatedVelocity: Velocity = {
      x: displacement.x / divisor,
      y: displacement.y / divisor,
      z: displacement.z / divisor,
    }

    return {
      ...state,
      position: updatedPosition,
      velocity: updatedVelocity,
      updatedAt: state.updatedAt + payload.deltaTime,
    }
  })

export type EntityDomainFailure = EntityDomainError | EntityNotFoundError | EntityCollisionError
