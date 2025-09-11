import * as S from '@effect/schema/Schema'
import { Brand, Data } from 'effect'

export type EntityId = string & Brand.Brand<'EntityId'>

export const EntityId = Brand.nominal<EntityId>()

export const EntityIdSchema = S.String.pipe(
  S.brand('EntityId'),
  S.annotations({
    title: 'EntityId',
    description: 'Unique identifier for an entity in the ECS system',
    examples: ['entity-1', 'entity-uuid-123'],
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