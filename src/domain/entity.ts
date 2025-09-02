import { Schema as S, Effect, ParseResult } from 'effect'

/**
 * A branded type for entity IDs to prevent accidental use of raw numbers.
 */
export const EntityIdSchema = S.Number.pipe(S.brand('EntityId'))
export type EntityId = S.Schema.Type<typeof EntityIdSchema>

const decodeEntityId = S.decode(EntityIdSchema)
const encodeEntityId = S.encode(EntityIdSchema)

/**
 * Decodes a number into an EntityId, returning an Effect.
 * @param id The number to decode.
 * @returns An `Effect<EntityId, ParseError, never>`.
 */
export function toEntityId(id: number): Effect.Effect<EntityId, ParseResult.ParseError> {
  return decodeEntityId(id)
}

/**
 * Encodes an EntityId back to a number, returning an Effect.
 * @param id The EntityId to encode.
 * @returns An `Effect<number, ParseError, never>`.
 */
export function fromEntityId(id: EntityId): Effect.Effect<number, ParseResult.ParseError> {
  return encodeEntityId(id)
}
