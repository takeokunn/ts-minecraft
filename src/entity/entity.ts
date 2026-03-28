import { Option, Schema } from 'effect'
import { PositionSchema, type Position } from '@/shared/kernel'
import { Vector3Schema, QuaternionSchema, identity, zero, type Quaternion, type Vector3 } from '@/shared/math/three'

export const EntityIdSchema = Schema.String.pipe(Schema.brand('EntityId'))
export type EntityId = Schema.Schema.Type<typeof EntityIdSchema>
export const EntityId = {
  make: (value: string): EntityId => value as unknown as EntityId,
}

export const EntityTypeSchema = Schema.Literal('Zombie', 'Cow', 'Pig', 'Sheep')
export type EntityType = Schema.Schema.Type<typeof EntityTypeSchema>
export const EntityType = {
  Zombie: 'Zombie' as const,
  Cow: 'Cow' as const,
  Pig: 'Pig' as const,
  Sheep: 'Sheep' as const,
}

export const MobBehaviorSchema = Schema.Literal('hostile', 'passive')
export type MobBehavior = Schema.Schema.Type<typeof MobBehaviorSchema>

export const EntitySchema = Schema.Struct({
  entityId: EntityIdSchema,
  position: PositionSchema,
  velocity: Vector3Schema,
  rotation: QuaternionSchema,
  health: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  type: EntityTypeSchema,
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
  velocity: Option.getOrElse(Option.fromNullable(params.velocity), () => zero),
  rotation: Option.getOrElse(Option.fromNullable(params.rotation), () => identity),
  health: params.health,
  type: params.type,
})
