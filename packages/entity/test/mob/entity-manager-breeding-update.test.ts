import { Effect, HashMap, Option, Ref } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import type { Position } from '@ts-minecraft/core'
import { BABY_GROW_TICKS } from '../../domain/mob/breeding'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { collectBreedingCandidates } from '../../application/mob/entity-manager-breeding-candidates'
import { runBreedingUpdate } from '../../application/mob/entity-manager-breeding-update'
import { expectSome, makeTestManagedEntity } from './test-utils'

describe('entity/entityManagerBreedingUpdate', () => {
  it('collects only willing adult candidates', () => {
    const inLoveAdult = makeTestManagedEntity({
      entityId: EntityId.make('entity-cow-adult'),
      type: EntityType.Cow,
      loveTicksRemaining: 40,
    })
    const baby = makeTestManagedEntity({
      entityId: EntityId.make('entity-cow-baby'),
      type: EntityType.Cow,
      loveTicksRemaining: 40,
      ageTicks: BABY_GROW_TICKS - 1,
    })
    const notInLove = makeTestManagedEntity({
      entityId: EntityId.make('entity-pig-adult'),
      type: EntityType.Pig,
      loveTicksRemaining: 0,
    })

    const entities = HashMap.set(
      HashMap.set(
        HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), inLoveAdult.entityId, inLoveAdult),
        baby.entityId,
        baby,
      ),
      notInLove.entityId,
      notInLove,
    )

    expect(collectBreedingCandidates(entities)).toEqual([
      {
        id: inLoveAdult.entityId,
        type: EntityType.Cow,
        position: inLoveAdult.position,
      },
    ])
  })

  it.effect('runs the breeding pass, resets parents, and records a birth', () =>
    Effect.gen(function* () {
      const parentA = makeTestManagedEntity({
        entityId: EntityId.make('entity-parent-a'),
        type: EntityType.Cow,
        position: { x: 0, y: 64, z: 0 },
        loveTicksRemaining: 40,
      })
      const parentB = makeTestManagedEntity({
        entityId: EntityId.make('entity-parent-b'),
        type: EntityType.Cow,
        position: { x: 2, y: 64, z: 0 },
        loveTicksRemaining: 35,
      })
      const unrelated = makeTestManagedEntity({
        entityId: EntityId.make('entity-unrelated'),
        type: EntityType.Pig,
        position: { x: 20, y: 64, z: 0 },
      })

      const entitiesRef = yield* Ref.make(
        HashMap.set(
          HashMap.set(
            HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), parentA.entityId, parentA),
            parentB.entityId,
            parentB,
          ),
          unrelated.entityId,
          unrelated,
        ),
      )
      const birthsRef = yield* Ref.make(0)
      const cachedEntitiesRef = yield* Ref.make<Option.Option<ReadonlyArray<unknown>>>(Option.some([{ stale: true }]))
      const spawned: Array<{ readonly type: EntityType; readonly position: Position; readonly ageTicks: number }> = []

      yield* runBreedingUpdate(
        entitiesRef,
        birthsRef,
        cachedEntitiesRef,
        (type, position, ageTicks = BABY_GROW_TICKS) =>
          Effect.sync(() => {
            spawned.push({ type, position, ageTicks })
            return EntityId.make('entity-baby')
          }),
      )

      const updatedEntities = yield* Ref.get(entitiesRef)
      const updatedA = expectSome(HashMap.get(updatedEntities, parentA.entityId))
      const updatedB = expectSome(HashMap.get(updatedEntities, parentB.entityId))

      expect(updatedA.loveTicksRemaining).toBe(0)
      expect(updatedA.breedCooldownRemaining).toBeGreaterThan(0)
      expect(updatedB.loveTicksRemaining).toBe(0)
      expect(updatedB.breedCooldownRemaining).toBeGreaterThan(0)
      expect(yield* Ref.get(birthsRef)).toBe(1)
      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.none())
      expect(spawned).toEqual([
        {
          type: EntityType.Cow,
          position: { x: 1, y: 64, z: 0 },
          ageTicks: 0,
        },
      ])
    }))
})
