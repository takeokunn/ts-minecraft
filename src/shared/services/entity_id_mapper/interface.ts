import type { DomainEntityId } from '@domain/entities/value_object/domain_entity_id'
import type { ECSEntityId } from '@infrastructure/ecs/value_object/ecs_entity_id'
import { Context, Effect } from 'effect'
import { EntityIdMappingError } from './errors'

// -----------------------------------------------------------------------------
// EntityIdMapper サービスインターフェース
// -----------------------------------------------------------------------------

/**
 * DomainEntityIdとECSEntityId間の双方向マッピングを提供
 *
 * ドメイン層とECS層のエンティティIDを相互変換するサービス。
 * HashMap-based実装により高速な検索を実現。
 */
export interface EntityIdMapper {
  /**
   * DomainEntityIdからECSEntityIdへ変換
   * マッピングが存在しない場合はEntityIdMappingErrorを返す
   */
  readonly toECS: (domainId: DomainEntityId) => Effect.Effect<ECSEntityId, EntityIdMappingError>

  /**
   * ECSEntityIdからDomainEntityIdへ変換
   * マッピングが存在しない場合はEntityIdMappingErrorを返す
   */
  readonly toDomain: (ecsId: ECSEntityId) => Effect.Effect<DomainEntityId, EntityIdMappingError>

  /**
   * DomainEntityIdとECSEntityIdのマッピングを登録
   * 既存マッピングは上書きされる
   */
  readonly register: (domainId: DomainEntityId, ecsId: ECSEntityId) => Effect.Effect<void, never>

  /**
   * DomainEntityIdのマッピングが存在するか確認
   */
  readonly has: (domainId: DomainEntityId) => Effect.Effect<boolean, never>

  /**
   * 全マッピングをクリア（テスト用）
   */
  readonly clear: () => Effect.Effect<void, never>
}

export const EntityIdMapper = Context.GenericTag<EntityIdMapper>('@shared/EntityIdMapper')
