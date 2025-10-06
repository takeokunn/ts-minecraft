import type { DomainEntityId } from '@domain/entities/value_object/domain_entity_id'
import type { ECSEntityId } from '@infrastructure/ecs/value_object/ecs_entity_id'
import { Effect, HashMap, Layer, Option, Ref } from 'effect'
import { EntityIdMappingError } from './errors'
import { EntityIdMapper } from './interface'

// -----------------------------------------------------------------------------
// EntityIdMapper Live実装
// -----------------------------------------------------------------------------

/**
 * EntityIdMapperのLive実装
 *
 * 2つのHashMapを使用した双方向マッピング：
 * - domainToECS: DomainEntityId → ECSEntityId
 * - ecsToDomain: ECSEntityId → DomainEntityId
 *
 * RefでラップすることでEffect内での安全な状態管理を実現
 */
export const EntityIdMapperLive = Layer.effect(
  EntityIdMapper,
  Effect.gen(function* () {
    // 双方向マッピング用の状態
    const domainToECS = yield* Ref.make(HashMap.empty<DomainEntityId, ECSEntityId>())
    const ecsToDomain = yield* Ref.make(HashMap.empty<ECSEntityId, DomainEntityId>())

    return EntityIdMapper.of({
      toECS: (domainId: DomainEntityId) =>
        Effect.gen(function* () {
          const map = yield* Ref.get(domainToECS)
          const ecsId = HashMap.get(map, domainId)

          if (Option.isNone(ecsId)) {
            return yield* Effect.fail(
              new EntityIdMappingError({
                direction: 'domain_to_ecs',
                id: domainId,
              })
            )
          }

          return ecsId.value
        }),

      toDomain: (ecsId: ECSEntityId) =>
        Effect.gen(function* () {
          const map = yield* Ref.get(ecsToDomain)
          const domainId = HashMap.get(map, ecsId)

          if (Option.isNone(domainId)) {
            return yield* Effect.fail(
              new EntityIdMappingError({
                direction: 'ecs_to_domain',
                id: String(ecsId),
              })
            )
          }

          return domainId.value
        }),

      register: (domainId: DomainEntityId, ecsId: ECSEntityId) =>
        Effect.gen(function* () {
          yield* Ref.update(domainToECS, HashMap.set(domainId, ecsId))
          yield* Ref.update(ecsToDomain, HashMap.set(ecsId, domainId))
        }),

      has: (domainId: DomainEntityId) =>
        Effect.gen(function* () {
          const map = yield* Ref.get(domainToECS)
          return Option.isSome(HashMap.get(map, domainId))
        }),

      clear: () =>
        Effect.gen(function* () {
          yield* Ref.set(domainToECS, HashMap.empty())
          yield* Ref.set(ecsToDomain, HashMap.empty())
        }),
    })
  })
)
