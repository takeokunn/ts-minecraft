import { Schema as S } from 'effect'

/**
 * A branded type for entity IDs to prevent accidental use of raw numbers.
 */
export const EntityIdSchema = S.Number.pipe(S.brand('EntityId'))
export type EntityId = S.Schema.Type<typeof EntityIdSchema>

const decodeEntityId = S.decodeSync(EntityIdSchema)
const encodeEntityId = S.encodeSync(EntityIdSchema)

/**
 * Decodes a number into an EntityId, throwing an error if invalid.
 * @param id The number to decode.
 * @returns The number as an EntityId.
 */
export function toEntityId(id: number): EntityId {
  return decodeEntityId(id)
}

/**
 * Encodes an EntityId back to a number.
 * @param id The EntityId to encode.
 * @returns The EntityId as a number.
 */
export function fromEntityId(id: EntityId): number {
  return encodeEntityId(id)
}
