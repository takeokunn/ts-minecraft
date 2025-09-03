import { Brand, Effect } from 'effect'
import * as S from 'effect/Schema'

/**
 * A branded type for entity IDs to prevent accidental use of raw numbers.
 */
export type EntityId = Brand.Branded<number, 'EntityId'>
export const EntityId = Brand.nominal<EntityId>()
export const EntityIdSchema: S.Schema<EntityId> = S.Number.pipe(S.brand('EntityId'))

export const toEntityId = (id: number): Effect.Effect<EntityId> => S.decode(EntityIdSchema)(id)