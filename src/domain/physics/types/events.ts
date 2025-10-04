import { Schema } from 'effect'
import { AABBSchema, EpochMillisSchema, PhysicsWorldIdSchema, RigidBodyIdSchema, Vector3Schema } from './core'

const WorldSteppedSchema = Schema.Struct({
  _tag: Schema.Literal('WorldStepped'),
  worldId: PhysicsWorldIdSchema,
  deltaTime: Schema.Number.pipe(Schema.greaterThan(0)),
  completedAt: EpochMillisSchema,
})

const RigidBodyUpdatedSchema = Schema.Struct({
  _tag: Schema.Literal('RigidBodyUpdated'),
  worldId: PhysicsWorldIdSchema,
  rigidBodyId: RigidBodyIdSchema,
  position: Vector3Schema,
  velocity: Vector3Schema,
  occurredAt: EpochMillisSchema,
})

const CollisionDetectedSchema = Schema.Struct({
  _tag: Schema.Literal('CollisionDetected'),
  worldId: PhysicsWorldIdSchema,
  rigidBodyId: RigidBodyIdSchema,
  contactAABB: AABBSchema,
  normal: Vector3Schema,
  occurredAt: EpochMillisSchema,
})

export const PhysicsEventSchema = Schema.Union(WorldSteppedSchema, RigidBodyUpdatedSchema, CollisionDetectedSchema)

export type PhysicsEvent = Schema.Schema.Type<typeof PhysicsEventSchema>
export type WorldSteppedEvent = Schema.Schema.Type<typeof WorldSteppedSchema>
export type RigidBodyUpdatedEvent = Schema.Schema.Type<typeof RigidBodyUpdatedSchema>
export type CollisionDetectedEvent = Schema.Schema.Type<typeof CollisionDetectedSchema>
