import * as S from "@effect/schema/Schema"

/**
 * A branded type for entity IDs to prevent accidental use of raw numbers.
 */
export const EntityIdSchema = S.Number.pipe(S.brand('EntityId'))
export type EntityId = S.Schema.Type<typeof EntityIdSchema>

export const toEntityId = S.decodeUnknownSync(EntityIdSchema)

// Re-export World from runtime services for compatibility
export { World } from '@/runtime/services'
