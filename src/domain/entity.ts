import { Schema as S, Brand, Effect, ParseResult } from 'effect'

/**
 * A branded type for entity IDs to prevent accidental use of raw numbers.
 */
export type EntityId = Brand.Branded<number, 'EntityId'>
export const EntityId = Brand.nominal<EntityId>()
export const EntityIdSchema = S.Number.pipe(S.brand('EntityId'))

export const toEntityId = (id: number): Effect.Effect<EntityId, ParseResult.ParseError> => S.decodeUnknown(EntityIdSchema)(id)
