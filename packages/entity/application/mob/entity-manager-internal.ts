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
import { LOVE_DURATION_TICKS, canAcceptBreedingFood, isBaby, acceleratedBabyAge } from '../../domain/mob/breeding'
import { computeExplosionDamageAt, CREEPER_EXPLOSION_POWER } from '../../domain/explosion'
import { CREEPER_FUSE_SECONDS } from '../../domain/mob/creeper-fuse'
import { shouldDespawnEntity } from '../../domain/mob/entity-manager-utils'
import {
  TELEPORT_ATTEMPTS,
  computeEndermanTeleportTarget,
  shouldEndermanTeleport,
} from '../../domain/mob/enderman-teleport'
import { hashEntityId } from '../../domain/mob/entity-utils'

const makeDeterministicRoll = (entity: ManagedEntity, salt: number): number =>
  ((hashEntityId(entity.entityId) + Math.floor(entity.health * 31) + salt * 997) % 1000) / 1000

const makeTeleportAttempts = (entity: ManagedEntity, salt: number): ReadonlyArray<number> =>
  Array.from({ length: TELEPORT_ATTEMPTS * 2 }, (_, index) => makeDeterministicRoll(entity, salt + index + 1))

// ── Internal method factory ──────────────────────────────────────────────────

export const makeEntityManagerInternal = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
) => ({
  getPlayerContactDamage: (playerPosition: Position): Effect.Effect<number, never> =>
    Ref.modify(entitiesRef, (entities): [{ damage: number; removed: boolean }, HashMap.HashMap<EntityId, ManagedEntity>] => {
      let totalDamage = 0
      let updatedEntities = entities
      let touched = false
      let removed = false
      HashMap.forEach(entities, (entity) => {
        // Creepers never melee — once the fuse completes they detonate, dealing
        // area explosion damage and self-destructing.
        if (entity.type === EntityType.Creeper) {
          if (entity.fuseSecs >= CREEPER_FUSE_SECONDS) {
            totalDamage += computeExplosionDamageAt(entity.position, CREEPER_EXPLOSION_POWER, playerPosition)
            updatedEntities = HashMap.remove(updatedEntities, entity.entityId)
            touched = true
            removed = true
          }
          return
        }
        if (entity.behavior !== 'hostile' || entity.attackDamage <= 0) return
        if (entity.attackCooldownRemaining > 0) return
        const distSq = distanceToPlayerSq(entity.position, playerPosition)
        if (distSq <= entity.attackRange * entity.attackRange) {
          totalDamage += entity.attackDamage
          updatedEntities = HashMap.set(updatedEntities, entity.entityId, {
            ...entity,
            attackCooldownRemaining: HOSTILE_ATTACK_COOLDOWN_SECS,
          })
          touched = true
        }
      })
      return [{ damage: totalDamage, removed }, touched ? updatedEntities : entities]
    }).pipe(
      Effect.flatMap(({ damage, removed }) =>
        removed
          ? Effect.all([
              Ref.set(cachedEntitiesRef, Option.none()),
              Ref.update(structureVersionRef, (version) => version + 1),
            ], { concurrency: 'unbounded', discard: true }).pipe(Effect.as(damage))
          : damage > 0
            ? Ref.set(cachedEntitiesRef, Option.none()).pipe(Effect.as(damage))
            : Effect.succeed(damage),
      ),
    ),

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

            const shouldTeleport = entity.type === EntityType.Enderman
              && shouldEndermanTeleport(true, 0, 0)
            const teleportTarget = shouldTeleport
              ? computeEndermanTeleportTarget(
                  entity.position,
                  entity.position,
                  makeTeleportAttempts(entity, Math.floor(nextHealth)),
                )
              : null
            const nextPosition: Position = teleportTarget ?? entity.position

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

  // FR R6: feed a breeding item to an entity. Enters love mode (returns true) only
  // if it is a willing adult (off cooldown, not already in love). The caller checks
  // the held item matches the mob's breedingItem before invoking this.
  feedEntity: (entityId: EntityId): Effect.Effect<boolean, never> =>
    Ref.modify(entitiesRef, (entities): [boolean, HashMap.HashMap<EntityId, ManagedEntity>] =>
      Option.match(HashMap.get(entities, entityId), {
        onNone: () => [false, entities],
        onSome: (entity) => {
          // Feeding a baby accelerates its growth (vanilla); feeding a willing adult
          // enters love mode. An in-love / cooling-down adult declines (no consume).
          if (isBaby(entity.ageTicks)) {
            return [true, HashMap.set(entities, entityId, { ...entity, ageTicks: acceleratedBabyAge(entity.ageTicks) })]
          }
          return canAcceptBreedingFood({
            loveTicksRemaining: entity.loveTicksRemaining,
            breedCooldownRemaining: entity.breedCooldownRemaining,
            ageTicks: entity.ageTicks,
          })
            ? [true, HashMap.set(entities, entityId, { ...entity, loveTicksRemaining: LOVE_DURATION_TICKS })]
            : [false, entities]
        },
      }),
    ).pipe(Effect.tap((fed) => (fed ? Ref.set(cachedEntitiesRef, Option.none()) : Effect.void))),
})
