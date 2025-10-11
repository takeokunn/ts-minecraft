import { Schema } from 'effect'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'

// -----------------------------------------------------------------------------
// EntityIdMapper エラー定義
// -----------------------------------------------------------------------------

/**
 * EntityIdマッピング失敗エラー
 *
 * DomainEntityId ⇄ ECSEntityId の変換時に、
 * マッピングが存在しない場合に発生
 */
export const EntityIdMappingErrorSchema = Schema.TaggedError('EntityIdMappingError', {
  direction: Schema.Literal('domain_to_ecs', 'ecs_to_domain'),
  id: Schema.String,
})

export type EntityIdMappingError = Schema.Schema.Type<typeof EntityIdMappingErrorSchema>

type EntityIdMappingErrorExtras = Partial<Omit<EntityIdMappingError, 'direction' | 'id'>>

const makeEntityIdMappingError = (
  direction: EntityIdMappingError['direction'],
  id: string,
  extras?: EntityIdMappingErrorExtras
): EntityIdMappingError =>
  EntityIdMappingErrorSchema.make({
    direction,
    id,
    ...extras,
  })

export const EntityIdMappingError = {
  ...makeErrorFactory(EntityIdMappingErrorSchema),
  domainToEcsMissing: (id: string, extras?: EntityIdMappingErrorExtras) =>
    makeEntityIdMappingError('domain_to_ecs', id, extras),
  ecsToDomainMissing: (id: string, extras?: EntityIdMappingErrorExtras) =>
    makeEntityIdMappingError('ecs_to_domain', id, extras),
} as const
