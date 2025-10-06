import { Schema } from 'effect'

// -----------------------------------------------------------------------------
// EntityIdMapper エラー定義
// -----------------------------------------------------------------------------

/**
 * EntityIdマッピング失敗エラー
 *
 * DomainEntityId ⇄ ECSEntityId の変換時に、
 * マッピングが存在しない場合に発生
 */
export class EntityIdMappingError extends Schema.TaggedError<EntityIdMappingError>()('EntityIdMappingError', {
  direction: Schema.Literal('domain_to_ecs', 'ecs_to_domain'),
  id: Schema.String,
}) {}
