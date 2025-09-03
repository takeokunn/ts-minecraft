import * as S from 'effect/Schema'

/**
 * A branded type for entity IDs to prevent accidental use of raw numbers.
 */
export const EntityIdSchema = S.Number.pipe(S.brand('EntityId'))
export type EntityId = S.Schema.Type<typeof EntityIdSchema>

const decodeEntityId = S.decodeSync(EntityIdSchema)
export const toEntityId = (id: number): EntityId => decodeEntityId(id)