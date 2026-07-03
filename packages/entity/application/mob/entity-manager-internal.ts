import { Effect, HashMap, Option, Ref } from 'effect'
import type { Entity, EntityId } from '../../domain/mob/entity'
import type { Position } from '@ts-minecraft/core'
import type { ExplosionEvent } from '../../domain/explosion'
import { type ManagedEntity } from '../../domain/mob/entity-internal'
import { type PlayerContactDamageResolution, resolvePlayerContactDamage, resolvePlayerRangedDamage, type PlayerShotOrigin } from './entity-manager-combat'
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
  playerIgniteSecsRef: Ref.Ref<number>,
  playerShotOriginsRef: Ref.Ref<ReadonlyArray<PlayerShotOrigin>>,
) => ({
  ...makeEntityManagerLifecycle(entitiesRef, cachedEntitiesRef, structureVersionRef),
  ...makeEntityManagerActions(entitiesRef, cachedEntitiesRef, structureVersionRef),

  getPlayerContactDamageResolution: (playerPosition: Position): Effect.Effect<PlayerContactDamageResolution, never> =>
    Effect.gen(function* () {
      const resolution = yield* Ref.modify(entitiesRef, (entities): [PlayerContactDamageResolution, HashMap.HashMap<EntityId, ManagedEntity>] => {
        const [res, updatedEntities] = resolvePlayerContactDamage(entities, playerPosition)
        return [res, updatedEntities]
      })
      if (resolution.explosions.length > 0) {
        yield* Ref.update(explosionsRef, (pending) => [...pending, ...resolution.explosions])
      }
      if (resolution.removed) {
        yield* invalidateEntityCacheAndBumpStructureVersion(cachedEntitiesRef, structureVersionRef)
      } else if (resolution.damage > 0) {
        yield* invalidateEntityCache(cachedEntitiesRef)
      }
      return resolution
    }),

  getPlayerRangedDamage: (
    playerPosition: Position,
    isProjectileBlocked?: ProjectileBlocker,
  ): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const resolved = yield* Ref.modify(entitiesRef, (entities): [{ damage: number; igniteSecs: number; shotOrigins: ReadonlyArray<PlayerShotOrigin> }, HashMap.HashMap<EntityId, ManagedEntity>] => {
        const [resolution, updatedEntities] = resolvePlayerRangedDamage(entities, playerPosition, isProjectileBlocked)
        return [{ damage: resolution.damage, igniteSecs: resolution.igniteSecs, shotOrigins: resolution.shotOrigins }, updatedEntities]
      })
      if (resolved.igniteSecs > 0) {
        yield* Ref.update(playerIgniteSecsRef, (pending) => Math.max(pending, resolved.igniteSecs))
      }
      if (resolved.shotOrigins.length > 0) {
        yield* Ref.update(playerShotOriginsRef, (pending) => [...pending, ...resolved.shotOrigins])
      }
      if (resolved.damage > 0) {
        yield* invalidateEntityCache(cachedEntitiesRef)
      }
      return resolved.damage
    }),

  // Seconds of burning inflicted by fire-based ranged hits (Blaze fireballs)
  // since the last drain. The app frame applies it to the player's burn timer —
  // the entity layer never touches player state directly (DDD boundary).
  drainPlayerIgniteSecs: (): Effect.Effect<number, never> => Ref.getAndSet(playerIgniteSecsRef, 0),

  // Shooter positions of ranged hits since the last drain — the frame layer
  // draws tracer streaks from these to the player (shots are instant-hit).
  drainPlayerShotOrigins: (): Effect.Effect<ReadonlyArray<PlayerShotOrigin>, never> =>
    Ref.getAndSet(playerShotOriginsRef, [] as ReadonlyArray<PlayerShotOrigin>),
})
