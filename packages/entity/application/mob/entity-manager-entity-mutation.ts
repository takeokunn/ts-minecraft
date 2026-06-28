import { Effect, HashMap, Option, Ref } from 'effect'
import { EntityId, type Entity, type EntityId as EntityIdType, type EntityType } from '../../domain/mob/entity'
import { BABY_GROW_TICKS } from '../../domain/mob/breeding'
import type { Position, Quaternion, Vector3 } from '@ts-minecraft/core'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { createSpawnedManagedEntity } from './entity-manager-spawn'
import { invalidateEntityCache, invalidateEntityCacheAndBumpStructureVersion } from './entity-manager-cache'

export type EntitySnapshotMutation = Readonly<{
  entityId: EntityIdType
  entityType: EntityType
  position: Position
  health: number
  alive: boolean
  velocity?: Vector3
  rotation?: Quaternion
  isBaby?: boolean
  fuseSecs?: number
  fireSecs?: number
}>

export type EntitySnapshotMutationResult = 'created' | 'updated' | 'removed' | 'ignored'

const clampSnapshotHealth = (health: number, maxHealth: number): number => {
  if (!Number.isFinite(health)) return maxHealth
  return Math.min(Math.max(health, 0), maxHealth)
}

const createManagedEntityFromSnapshot = (snapshot: EntitySnapshotMutation): ManagedEntity => {
  const managedEntity = createSpawnedManagedEntity(
    snapshot.entityId,
    snapshot.entityType,
    snapshot.position,
    snapshot.isBaby === true ? 0 : BABY_GROW_TICKS,
  )
  return applySnapshotState(managedEntity, snapshot)
}

const applySnapshotState = (
  managedEntity: ManagedEntity,
  snapshot: EntitySnapshotMutation,
): ManagedEntity => {
  return {
    ...managedEntity,
    health: clampSnapshotHealth(snapshot.health, managedEntity.maxHealth),
    ...(snapshot.velocity !== undefined ? { velocity: snapshot.velocity } : {}),
    ...(snapshot.rotation !== undefined ? { rotation: snapshot.rotation } : {}),
    ...(snapshot.isBaby !== undefined
      ? { ageTicks: snapshot.isBaby ? 0 : BABY_GROW_TICKS }
      : {}),
    ...(snapshot.fuseSecs !== undefined ? { fuseSecs: snapshot.fuseSecs } : {}),
    ...(snapshot.fireSecs !== undefined
      ? {
          fireSecsRemaining: snapshot.fireSecs,
          fireDamageAccumulatorSecs: 0,
        }
      : {}),
  }
}

export const updateManagedEntity = <A>(
  entities: HashMap.HashMap<EntityId, ManagedEntity>,
  entityId: EntityId,
  onMissing: A,
  f: (entity: ManagedEntity) => readonly [A, ManagedEntity | null],
): readonly [A, HashMap.HashMap<EntityId, ManagedEntity>] => {
  const entity = Option.getOrNull(HashMap.get(entities, entityId))
  if (!entity) return [onMissing, entities]

  const [result, nextEntity] = f(entity)
  if (nextEntity === null) return [result, entities]

  return [result, HashMap.set(entities, entityId, nextEntity)]
}

export const makeEntityManagerMutations = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  nextEntityNumberRef: Ref.Ref<number>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
) => ({
  addEntity: (
    type: EntityType,
    position: Position,
    ageTicks: number = BABY_GROW_TICKS,
  ): Effect.Effect<EntityIdType, never> =>
    Effect.gen(function* () {
      const entityId = yield* Ref.modify(nextEntityNumberRef, (next): [EntityIdType, number] => [
        EntityId.make(`entity-${next}`),
        next + 1,
      ])
      const managedEntity = createSpawnedManagedEntity(entityId, type, position, ageTicks)

      yield* Ref.update(entitiesRef, (entities) => HashMap.set(entities, entityId, managedEntity))
      yield* invalidateEntityCacheAndBumpStructureVersion(cachedEntitiesRef, structureVersionRef)

      return entityId
    }),

  removeEntity: (entityId: EntityIdType): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const removed = yield* Ref.modify(
        entitiesRef,
        (entities): [boolean, HashMap.HashMap<EntityId, ManagedEntity>] => {
          const entity = Option.getOrNull(HashMap.get(entities, entityId))
          return entity === null ? [false, entities] : [true, HashMap.remove(entities, entityId)]
        },
      )
      if (removed) {
        yield* invalidateEntityCacheAndBumpStructureVersion(cachedEntitiesRef, structureVersionRef)
      }
      return removed
    }),

  applyEntitySnapshot: (
    snapshot: EntitySnapshotMutation,
  ): Effect.Effect<EntitySnapshotMutationResult, never> =>
    Effect.gen(function* () {
      const [result, structuralChange] = yield* Ref.modify(
        entitiesRef,
        (
          entities,
        ): [
          readonly [EntitySnapshotMutationResult, boolean],
          HashMap.HashMap<EntityId, ManagedEntity>,
        ] => {
          const current = Option.getOrNull(HashMap.get(entities, snapshot.entityId))

          if (!snapshot.alive) {
            return current === null
              ? [['ignored', false], entities]
              : [['removed', true], HashMap.remove(entities, snapshot.entityId)]
          }

          if (current === null) {
            return [
              ['created', true],
              HashMap.set(entities, snapshot.entityId, createManagedEntityFromSnapshot(snapshot)),
            ]
          }

          if (current.type !== snapshot.entityType) {
            return [
              ['updated', true],
              HashMap.set(entities, snapshot.entityId, createManagedEntityFromSnapshot(snapshot)),
            ]
          }

          return [
            ['updated', false],
            HashMap.set(
              entities,
              snapshot.entityId,
              applySnapshotState(
                {
                  ...current,
                  position: snapshot.position,
                },
                snapshot,
              ),
            ),
          ]
        },
      )

      if (structuralChange) {
        yield* invalidateEntityCacheAndBumpStructureVersion(cachedEntitiesRef, structureVersionRef)
      } else if (result === 'updated') {
        yield* invalidateEntityCache(cachedEntitiesRef)
      }

      return result
    }),
})
