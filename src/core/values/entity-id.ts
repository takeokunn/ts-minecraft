import * as S from '@effect/schema/Schema'
import { Brand, Data } from 'effect'

export type EntityId = string & Brand.Brand<'EntityId'>

export const EntityId = Brand.nominal<EntityId>()

export const EntityIdSchema = S.String.pipe(
  S.brand('EntityId'),
  S.annotations({
    title: 'EntityId',
    description: 'Unique identifier for an entity in the ECS system',
    examples: [EntityId('entity-1'), EntityId('entity-uuid-123')],
  }),
)

// Convert to Data.struct for immutability
export const EntityIdValue = Data.struct<{
  readonly value: EntityId
}>

export const makeEntityId = (value: string): EntityId => EntityId(value)

export const makeEntityIdValue = (value: string) =>
  EntityIdValue({
    value: makeEntityId(value),
  })

export const isEntityId = (value: unknown): value is EntityId =>
  typeof value === 'string' && value.length > 0

// Additional functions for test compatibility
export const createEntityId = (value: string): EntityId => makeEntityId(value)

export const generateEntityId = (): EntityId => {
  const uuid = `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  return makeEntityId(uuid)
}

export const entityIdToString = (entityId: EntityId): string => entityId