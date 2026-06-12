import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
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
import { WOOL_REGROWTH_TICKS, canBeSheared, shearWoolCount } from '../../domain/mob/shearing'
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
  Arr.makeBy(TELEPORT_ATTEMPTS * 2, (index) => makeDeterministicRoll(entity, salt + index + 1))

// ── Internal method factory ──────────────────────────────────────────────────

export const makeEntityManagerInternal = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
) => ({
  getPlayerContactDamage: (playerPosition: Position): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const { damage, removed } = yield* Ref.modify(entitiesRef, (entities): [{ damage: number; removed: boolean }, HashMap.HashMap<EntityId, ManagedEntity>] => {
        let totalDamage = 0
        let updatedEntities = entities
        let touched = false
        let entityRemoved = false
        HashMap.forEach(entities, (entity) => {
          // Creepers never melee — once the fuse completes they detonate, dealing
          // area explosion damage and self-destructing.
          if (entity.type === EntityType.Creeper) {
            if (entity.fuseSecs >= CREEPER_FUSE_SECONDS) {
              totalDamage += computeExplosionDamageAt(entity.position, CREEPER_EXPLOSION_POWER, playerPosition)
              updatedEntities = HashMap.remove(updatedEntities, entity.entityId)
              touched = true
              entityRemoved = true
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
        return [{ damage: totalDamage, removed: entityRemoved }, touched ? updatedEntities : entities]
      })
      if (removed) {
        yield* Effect.all([
          Ref.set(cachedEntitiesRef, Option.none()),
          Ref.update(structureVersionRef, (version) => version + 1),
        ], { concurrency: 'unbounded', discard: true })
      } else if (damage > 0) {
        yield* Ref.set(cachedEntitiesRef, Option.none())
      }
      return damage
    }),

  despawnFarEntities: (
    playerPosition: Position,
    maxDistance: number,
  ): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const removedCount = yield* Ref.modify(entitiesRef, (entities): [number, HashMap.HashMap<EntityId, ManagedEntity>] => {
        let count = 0
        let updatedEntities = entities

        HashMap.forEach(entities, (entity, entityId) => {
          if (!shouldDespawnEntity(entity, playerPosition, maxDistance)) {
            return
          }

          count += 1
          updatedEntities = HashMap.remove(updatedEntities, entityId)
        })

        return [count, count > 0 ? updatedEntities : entities]
      })
      if (removedCount > 0) {
        yield* Effect.all([
          Ref.set(cachedEntitiesRef, Option.none()),
          Ref.update(structureVersionRef, (version) => version + 1),
        ], { concurrency: 'unbounded', discard: true })
      }
      return removedCount
    }),

  despawnAllEntities: (): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const removedCount = yield* Ref.modify(
        entitiesRef,
        (entities): [number, HashMap.HashMap<EntityId, ManagedEntity>] => {
          const count = HashMap.size(entities)
          return [count, count > 0 ? HashMap.empty() : entities]
        },
      )
      if (removedCount > 0) {
        yield* Effect.all([
          Ref.set(cachedEntitiesRef, Option.none()),
          Ref.update(structureVersionRef, (version) => version + 1),
        ], { concurrency: 'unbounded', discard: true })
      }
      return removedCount
    }),

  applyDamage: (
    entityId: EntityId,
    amount: number,
  ): Effect.Effect<Option.Option<ReadonlyArray<EntityDrop>>, never> => {
    if (amount <= 0) {
      return Effect.succeed(Option.none())
    }

    return Effect.gen(function* () {
      const dropsOpt = yield* Ref.modify(
        entitiesRef,
        (
          entities,
        ): [Option.Option<ReadonlyArray<EntityDrop>>, HashMap.HashMap<EntityId, ManagedEntity>] => {
          const entity = Option.getOrNull(HashMap.get(entities, entityId))
          if (!entity) return [Option.none(), entities]

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
      )
      yield* Effect.all([
        Ref.set(cachedEntitiesRef, Option.none()),
        Option.isSome(dropsOpt)
          ? Ref.update(structureVersionRef, (version) => version + 1)
          : Effect.void,
      ], { concurrency: 'unbounded', discard: true })
      return dropsOpt
    })
  },

  applyKnockback: (
    entityId: EntityId,
    impulse: Vector3,
  ): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      yield* Ref.update(entitiesRef, (entities) => {
        const entity = Option.getOrNull(HashMap.get(entities, entityId))
        if (!entity) return entities
        return HashMap.set(entities, entityId, {
          ...entity,
          velocity: impulse,
          knockbackTicksRemaining: KNOCKBACK_DURATION_TICKS,
        })
      })
      yield* Ref.set(cachedEntitiesRef, Option.none())
    }),

  // FR R6: feed a breeding item to an entity. Enters love mode (returns true) only
  // if it is a willing adult (off cooldown, not already in love). The caller checks
  // the held item matches the mob's breedingItem before invoking this.
  feedEntity: (entityId: EntityId): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const fed = yield* Ref.modify(entitiesRef, (entities): [boolean, HashMap.HashMap<EntityId, ManagedEntity>] => {
        const entity = Option.getOrNull(HashMap.get(entities, entityId))
        if (!entity) return [false, entities]
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
      })
      if (fed) yield* Ref.set(cachedEntitiesRef, Option.none())
      return fed
    }),

  // FR R11: shear a sheep. Returns Some(woolCount) and starts the regrowth timer only
  // for a woolly sheep (type Sheep, regrowth at 0); None otherwise (wrong species, or
  // already sheared). The caller checks the held item is SHEARS before invoking this.
  shearEntity: (entityId: EntityId): Effect.Effect<Option.Option<number>, never> =>
    Effect.gen(function* () {
      const res = yield* Ref.modify(entitiesRef, (entities): [Option.Option<number>, HashMap.HashMap<EntityId, ManagedEntity>] => {
        const entity = Option.getOrNull(HashMap.get(entities, entityId))
        if (!entity) return [Option.none(), entities]
        if (entity.type !== EntityType.Sheep || !canBeSheared(entity.woolRegrowthTicks)) {
          return [Option.none(), entities]
        }
        const count = shearWoolCount(hashEntityId(entityId))
        return [
          Option.some(count),
          HashMap.set(entities, entityId, { ...entity, woolRegrowthTicks: WOOL_REGROWTH_TICKS }),
        ]
      })
      if (Option.isSome(res)) yield* Ref.set(cachedEntitiesRef, Option.none())
      return res
    }),
})
