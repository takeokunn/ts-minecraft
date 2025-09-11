import * as S from "effect/Schema"

/**
 * A branded type for entity IDs to prevent accidental use of raw numbers.
 */
export const EntityIdSchema = S.Number.pipe(S.brand('EntityId'))
export type EntityId = S.Schema.Type<typeof EntityIdSchema>

export const toEntityId = S.decodeUnknownSync(EntityIdSchema)

// Re-export WorldState from domain entities for compatibility
export { WorldState as World } from './world.entity'
