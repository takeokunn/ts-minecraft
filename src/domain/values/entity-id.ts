import * as S from 'effect/Schema'
import { Brand } from 'effect'

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

export const makeEntityId = (value: string): EntityId => EntityId(value)

export const isEntityId = (value: unknown): value is EntityId =>
  typeof value === 'string' && value.length > 0