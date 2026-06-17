import { Effect, HashMap, Option, Ref } from 'effect'
import type { Entity, EntityId } from '../../domain/mob/entity'
import type { Position } from '@ts-minecraft/core'
import type { ExplosionEvent } from '../../domain/explosion'
import { type ManagedEntity } from '../../domain/mob/entity-internal'
import { resolvePlayerContactDamage, resolvePlayerRangedDamage } from './entity-manager-combat'
import type { ProjectileBlocker } from './entity-manager-projectile'
import { makeEntityManagerActions } from './entity-manager-actions'
import { makeEntityManagerLifecycle } from './entity-manager-lifecycle'
import {
  invalidateEntityCache,
  invalidateEntityCacheAndBumpStructureVersion,
} from './entity-manager-cache'

// ── Internal method factory ──────────────────────────────────────────────────

export const makeEntityManagerInternal = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
  explosionsRef: Ref.Ref<ReadonlyArray<ExplosionEvent>>,
) => ({
  ...makeEntityManagerLifecycle(entitiesRef, cachedEntitiesRef, structureVersionRef),
  ...makeEntityManagerActions(entitiesRef, cachedEntitiesRef, structureVersionRef),

  getPlayerContactDamage: (playerPosition: Position): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const { damage, removed, explosions } = yield* Ref.modify(entitiesRef, (entities): [{ damage: number; removed: boolean; explosions: ReadonlyArray<ExplosionEvent> }, HashMap.HashMap<EntityId, ManagedEntity>] => {
        const [resolution, updatedEntities] = resolvePlayerContactDamage(entities, playerPosition)
        return [resolution, updatedEntities]
      })
      if (explosions.length > 0) {
        yield* Ref.update(explosionsRef, (pending) => [...pending, ...explosions])
      }
      if (removed) {
        yield* invalidateEntityCacheAndBumpStructureVersion(cachedEntitiesRef, structureVersionRef)
      } else if (damage > 0) {
        yield* invalidateEntityCache(cachedEntitiesRef)
      }
      return damage
    }),

  getPlayerRangedDamage: (
    playerPosition: Position,
    isProjectileBlocked?: ProjectileBlocker,
  ): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const damage = yield* Ref.modify(entitiesRef, (entities): [number, HashMap.HashMap<EntityId, ManagedEntity>] => {
        const [resolution, updatedEntities] = resolvePlayerRangedDamage(entities, playerPosition, isProjectileBlocked)
        return [resolution.damage, updatedEntities]
      })
      if (damage > 0) {
        yield* invalidateEntityCache(cachedEntitiesRef)
      }
      return damage
    }),
})
