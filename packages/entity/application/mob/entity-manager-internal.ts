import { Effect, HashMap, Option, Ref } from 'effect'
import type { EntityDrop } from '../../domain/mob/drop'
import { distanceToPlayerSq } from '../../domain/mob/state-machine'
import {
  EntityType,
  type Entity,
  type EntityId,
} from '../../domain/mob/entity'
import type { Position, Vector3 } from '@ts-minecraft/core'
import { HOSTILE_ATTACK_COOLDOWN_SECS, type ManagedEntity } from '../../domain/mob/entity-internal'
import { KNOCKBACK_DURATION_TICKS } from '../../domain/combat'
import { shouldDespawnEntity } from '../../domain/mob/entity-manager-utils'

// ── Internal method factory ──────────────────────────────────────────────────

export const makeEntityManagerInternal = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
) => ({
  getPlayerContactDamage: (playerPosition: Position): Effect.Effect<number, never> =>
    Ref.modify(entitiesRef, (entities): [number, HashMap.HashMap<EntityId, ManagedEntity>] => {
      let totalDamage = 0
      let updatedEntities = entities
      HashMap.forEach(entities, (entity) => {
        if (entity.behavior !== 'hostile' || entity.attackDamage <= 0) return
        if (entity.attackCooldownRemaining > 0) return
        const distSq = distanceToPlayerSq(entity.position, playerPosition)
        if (distSq <= entity.attackRange * entity.attackRange) {
          totalDamage += entity.attackDamage
          updatedEntities = HashMap.set(updatedEntities, entity.entityId, {
            ...entity,
            attackCooldownRemaining: HOSTILE_ATTACK_COOLDOWN_SECS,
          })
        }
      })
      return [totalDamage, totalDamage > 0 ? updatedEntities : entities]
    }).pipe(Effect.tap((damage) => damage > 0 ? Ref.set(cachedEntitiesRef, Option.none()) : Effect.void)),

  despawnFarEntities: (
    playerPosition: Position,
    maxDistance: number,
  ): Effect.Effect<number, never> =>
    Ref.modify(entitiesRef, (entities): [number, HashMap.HashMap<EntityId, ManagedEntity>] => {
      let removedCount = 0
      let updatedEntities = entities

      HashMap.forEach(entities, (entity, entityId) => {
        if (!shouldDespawnEntity(entity, playerPosition, maxDistance)) {
          return
        }

        removedCount += 1
        updatedEntities = HashMap.remove(updatedEntities, entityId)
      })

      return [removedCount, removedCount > 0 ? updatedEntities : entities]
    }).pipe(
      Effect.tap((removedCount) =>
        removedCount > 0
          ? Effect.all([
              Ref.set(cachedEntitiesRef, Option.none()),
              Ref.update(structureVersionRef, (version) => version + 1),
            ], { concurrency: 'unbounded', discard: true })
          : Effect.void,
      ),
    ),

  despawnAllEntities: (): Effect.Effect<number, never> =>
    Ref.modify(
      entitiesRef,
      (entities): [number, HashMap.HashMap<EntityId, ManagedEntity>] => {
        const removedCount = HashMap.size(entities)
        return [removedCount, removedCount > 0 ? HashMap.empty() : entities]
      },
    ).pipe(
      Effect.tap((removedCount) =>
        removedCount > 0
          ? Effect.all([
              Ref.set(cachedEntitiesRef, Option.none()),
              Ref.update(structureVersionRef, (version) => version + 1),
            ], { concurrency: 'unbounded', discard: true })
          : Effect.void,
      ),
    ),

  applyDamage: (
    entityId: EntityId,
    amount: number,
  ): Effect.Effect<Option.Option<ReadonlyArray<EntityDrop>>, never> => {
    if (amount <= 0) {
      return Effect.succeed(Option.none())
    }

    return Ref.modify(
      entitiesRef,
      (
        entities,
      ): [Option.Option<ReadonlyArray<EntityDrop>>, HashMap.HashMap<EntityId, ManagedEntity>] =>
        Option.match(HashMap.get(entities, entityId), {
          onNone: () => [Option.none(), entities],
          onSome: (entity) => {
            const nextHealth = entity.health - amount
            if (nextHealth <= 0) {
              return [Option.some(entity.drops), HashMap.remove(entities, entityId)]
            }

            const nextPosition: Position = entity.type === EntityType.Enderman
              ? (() => {
                  const angle = (nextHealth * 1.618) % (Math.PI * 2)
                  const dist = 4 + (Math.floor(nextHealth) % 8)
                  return {
                    x: entity.position.x + Math.cos(angle) * dist,
                    y: entity.position.y,
                    z: entity.position.z + Math.sin(angle) * dist,
                  }
                })()
              : entity.position

            return [
              Option.none(),
              HashMap.set(entities, entityId, {
                ...entity,
                health: nextHealth,
                position: nextPosition,
              }),
            ]
          },
        }),
    ).pipe(Effect.tap((dropsOpt) =>
      Effect.all([
        Ref.set(cachedEntitiesRef, Option.none()),
        Option.match(dropsOpt, {
          onSome: () => Ref.update(structureVersionRef, (version) => version + 1),
          onNone: () => Effect.void,
        }),
      ], { concurrency: 'unbounded', discard: true })
    ))
  },

  applyKnockback: (
    entityId: EntityId,
    impulse: Vector3,
  ): Effect.Effect<void, never> =>
    Ref.update(entitiesRef, (entities) =>
      Option.match(HashMap.get(entities, entityId), {
        onNone: () => entities,
        onSome: (entity) =>
          HashMap.set(entities, entityId, {
            ...entity,
            velocity: impulse,
            knockbackTicksRemaining: KNOCKBACK_DURATION_TICKS,
          }),
      }),
    ).pipe(Effect.andThen(Ref.set(cachedEntitiesRef, Option.none()))),
})
