import { Schema } from 'effect'
import { AABBSchema, EpochMillisSchema, PhysicsWorldIdSchema, RigidBodyIdSchema, Vector3Schema } from './core'

const WorldSteppedSchema = Schema.Struct({
  _tag: Schema.Literal('WorldStepped'),
  worldId: Schema.suspend(() => PhysicsWorldIdSchema),
  deltaTime: Schema.Number.pipe(Schema.greaterThan(0)),
  completedAt: Schema.suspend(() => EpochMillisSchema),
})

const RigidBodyUpdatedSchema = Schema.Struct({
  _tag: Schema.Literal('RigidBodyUpdated'),
  worldId: Schema.suspend(() => PhysicsWorldIdSchema),
  rigidBodyId: Schema.suspend(() => RigidBodyIdSchema),
  position: Schema.suspend(() => Vector3Schema),
  velocity: Schema.suspend(() => Vector3Schema),
  occurredAt: Schema.suspend(() => EpochMillisSchema),
})

const CollisionDetectedSchema = Schema.Struct({
  _tag: Schema.Literal('CollisionDetected'),
  worldId: Schema.suspend(() => PhysicsWorldIdSchema),
  rigidBodyId: Schema.suspend(() => RigidBodyIdSchema),
  contactAABB: Schema.suspend(() => AABBSchema),
  normal: Schema.suspend(() => Vector3Schema),
  occurredAt: Schema.suspend(() => EpochMillisSchema),
})

export const PhysicsEventSchema = Schema.Union(WorldSteppedSchema, RigidBodyUpdatedSchema, CollisionDetectedSchema)

export type PhysicsEvent = Schema.Schema.Type<typeof PhysicsEventSchema>
export type WorldSteppedEvent = Schema.Schema.Type<typeof WorldSteppedSchema>
export type RigidBodyUpdatedEvent = Schema.Schema.Type<typeof RigidBodyUpdatedSchema>
export type CollisionDetectedEvent = Schema.Schema.Type<typeof CollisionDetectedSchema>
