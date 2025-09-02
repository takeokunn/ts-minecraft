import { Schema as S } from 'effect'

/**
 * A branded type for entity IDs to prevent accidental use of raw numbers.
 */
export const EntityId = S.Number.pipe(S.brand('EntityId'))
export type EntityId = S.Schema.Type<typeof EntityId>

/**
 * Casts a number to an EntityId.
 * @param id The number to cast.
 * @returns The number as an EntityId.
 */
export function toEntityId(id: number): EntityId {
  return id as EntityId
}

/**
 * Casts an EntityId back to a number.
 * @param id The EntityId to cast.
 * @returns The EntityId as a number.
 */
export function fromEntityId(id: EntityId): number {
  return id as number
}
