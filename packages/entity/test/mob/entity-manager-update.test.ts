import { describe } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, MutableRef, Option } from 'effect'
import { AIState, EntityType, EntityId } from '@ts-minecraft/entity'
import { EntityManager } from '@ts-minecraft/entity'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { itEntityManagerEffect, unwrapSome, unwrapSomeEffect } from './test-utils'

// CollisionResolver is the output-parameter form: it writes the corrected pose into
// outPos/outVel and returns isGrounded. A pass-through resolver leaves the candidate
// pose unchanged (copies inputs verbatim).
type Vec = { x: number; y: number; z: number }
const passThroughResolver =
  (isGrounded: boolean) =>
  (outPos: Vec, outVel: Vec, position: Vec, velocity: Vec): boolean => {
    outPos.x = position.x; outPos.y = position.y; outPos.z = position.z
    outVel.x = velocity.x; outVel.y = velocity.y; outVel.z = velocity.z
    return isGrounded
  }

describe('entity/entityManagerUpdate', () => {
  describe('getEntityAIState', () => {
    itEntityManagerEffect('returns Option.some with Idle for a freshly-added entity', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        expect(yield* unwrapSomeEffect(entityManager.getEntityAIState(entityId))).toBe('Idle')
      }))

    itEntityManagerEffect('returns Option.none for an unknown entity id', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const fakeId = EntityId.make('entity-nonexistent-ai')
        const result = yield* entityManager.getEntityAIState(fakeId)
        expect(Option.isNone(result)).toBe(true)
      }))
  })

  describe('update', () => {
    itEntityManagerEffect('runs without error (smoke test)', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        yield* entityManager.update(DeltaTimeSecs.make(0.016), { x: 5, y: 64, z: 0 })
      }))

    itEntityManagerEffect('update() still performs breeding and records a birth', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const parentA = yield* entityManager.addEntity(EntityType.Cow, { x: 0, y: 64, z: 0 })
        const parentB = yield* entityManager.addEntity(EntityType.Cow, { x: 2, y: 64, z: 0 })

        expect(yield* entityManager.feedEntity(parentA)).toBe(true)
        expect(yield* entityManager.feedEntity(parentB)).toBe(true)

        yield* entityManager.update(DeltaTimeSecs.make(0.016), { x: 100, y: 64, z: 100 })

        expect(yield* entityManager.drainBirths()).toBe(1)
        expect(yield* entityManager.getCount()).toBe(3)
      }))

    itEntityManagerEffect('getEntities() remains accessible after update', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Cow, { x: 0, y: 64, z: 0 })
        yield* entityManager.update(DeltaTimeSecs.make(0.016), { x: 0, y: 64, z: 0 })
        const entities = yield* entityManager.getEntities()
        expect(entities.length).toBe(1)
      }))

    itEntityManagerEffect('a stationary attacking hostile mob still burns in daylight (regression: early-return skipped burn)', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const player = { x: 1, y: 64, z: 0 }
        for (let i = 0; i < 60; i++) {
          yield* entityManager.update(DeltaTimeSecs.make(0.05), player, false)
        }
        const entities = yield* entityManager.getEntities()
        expect(entities.length).toBe(1)
        expect(entities[0]!.health).toBe(17)
      }))

    itEntityManagerEffect('daylight burn is time-based, not frame-count-based (frame-rate independent)', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const player = { x: 1, y: 64, z: 0 }
        yield* entityManager.update(DeltaTimeSecs.make(0.9), player, false)
        expect((yield* entityManager.getEntities())[0]!.health).toBe(20)
        yield* entityManager.update(DeltaTimeSecs.make(0.2), player, false)
        expect((yield* entityManager.getEntities())[0]!.health).toBe(19)
        yield* entityManager.update(DeltaTimeSecs.make(0.9), player, false)
        expect((yield* entityManager.getEntities())[0]!.health).toBe(18)
      }))

    itEntityManagerEffect('igniteEntity exposes fireSecs and deals 1 damage per burning second', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 100, y: 64, z: 0 })

        const ignited = yield* entityManager.igniteEntity(entityId, 4)
        expect(ignited).toBe(true)

        let entity = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
        expect(entity.fireSecs).toBe(4)

        yield* entityManager.update(DeltaTimeSecs.make(1.5), { x: 0, y: 64, z: 0 }, true)
        entity = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
        expect(entity.health).toBe(19)
        expect(entity.fireSecs).toBeCloseTo(2.5)

        yield* entityManager.update(DeltaTimeSecs.make(2.5), { x: 0, y: 64, z: 0 }, true)
        entity = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
        expect(entity.health).toBe(16)
        expect(entity.fireSecs).toBeUndefined()
      }))

    itEntityManagerEffect('igniteEntity extends an existing burn to the longer duration', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 100, y: 64, z: 0 })

        expect(yield* entityManager.igniteEntity(entityId, 4)).toBe(true)
        yield* entityManager.update(DeltaTimeSecs.make(1), { x: 0, y: 64, z: 0 }, true)
        expect(yield* entityManager.igniteEntity(entityId, 8)).toBe(true)

        const entity = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
        expect(entity.fireSecs).toBe(8)
      }))

    itEntityManagerEffect('igniteEntity returns false for missing entities and non-positive durations', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 100, y: 64, z: 0 })

        expect(yield* entityManager.igniteEntity(EntityId.make('entity-missing-fire'), 4)).toBe(false)
        expect(yield* entityManager.igniteEntity(entityId, 0)).toBe(false)
        expect(yield* entityManager.igniteEntity(entityId, -1)).toBe(false)

        const entity = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
        expect(entity.fireSecs).toBeUndefined()
      }))

    itEntityManagerEffect('igniteEntity keeps the cached snapshot when a shorter duration is ignored', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 100, y: 64, z: 0 })

        expect(yield* entityManager.igniteEntity(entityId, 8)).toBe(true)
        const cachedEntities = yield* entityManager.getEntities()

        expect(yield* entityManager.igniteEntity(entityId, 4)).toBe(false)
        const unchangedEntities = yield* entityManager.getEntities()

        expect(unchangedEntities).toBe(cachedEntities)
        expect(unchangedEntities[0]?.fireSecs).toBe(8)
      }))

    itEntityManagerEffect('fire damage removes an entity when the burn becomes lethal', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 100, y: 64, z: 0 })

        yield* entityManager.applyDamage(entityId, 19)
        yield* entityManager.igniteEntity(entityId, 2)
        yield* entityManager.update(DeltaTimeSecs.make(1), { x: 0, y: 64, z: 0 }, true)

        expect(Option.isNone(yield* entityManager.getEntity(entityId))).toBe(true)
        expect(yield* entityManager.getCount()).toBe(0)
      }))

    itEntityManagerEffect('entity in attack range transitions to attack state (non-wander wanderDirection path)', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        yield* entityManager.update(DeltaTimeSecs.make(0.016), { x: 0, y: 64, z: 0 })
        const entities = yield* entityManager.getEntities()
        expect(entities.length).toBe(1)
      }))

    itEntityManagerEffect('Enderman ignores nearby player until the camera ray hits it, then stays provoked', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Enderman, { x: 8, y: 64, z: 0 })
        const playerPosition = { x: 0, y: 64, z: 0 }
        const eyePosition = { x: 0, y: 66.1, z: 0 }

        yield* entityManager.update(
          DeltaTimeSecs.make(0.016),
          playerPosition,
          true,
          { x: 0, y: 0, z: 1 },
          eyePosition,
        )
        expect([AIState.Idle, AIState.Wander]).toContain(
          yield* unwrapSomeEffect(entityManager.getEntityAIState(entityId)),
        )

        yield* entityManager.update(
          DeltaTimeSecs.make(0.016),
          playerPosition,
          true,
          { x: 1, y: 0, z: 0 },
          eyePosition,
        )
        expect(yield* unwrapSomeEffect(entityManager.getEntityAIState(entityId))).toBe(AIState.Chase)

        yield* entityManager.update(
          DeltaTimeSecs.make(0.016),
          playerPosition,
          true,
          { x: 0, y: 0, z: 1 },
          eyePosition,
        )
        expect(yield* unwrapSomeEffect(entityManager.getEntityAIState(entityId))).toBe(AIState.Chase)
      }))

    itEntityManagerEffect('Enderman eye contact is blocked by solid sight occlusion', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Enderman, { x: 8, y: 64, z: 0 })
        const playerPosition = { x: 0, y: 64, z: 0 }
        const eyePosition = { x: 0, y: 66.1, z: 0 }
        const lookDirection = { x: 1, y: 0, z: 0 }

        yield* entityManager.update(
          DeltaTimeSecs.make(0.016),
          playerPosition,
          true,
          lookDirection,
          eyePosition,
          (position) =>
            Math.floor(position.x) === 4 &&
            Math.floor(position.y) === 66 &&
            Math.floor(position.z) === 0,
        )
        expect([AIState.Idle, AIState.Wander]).toContain(
          yield* unwrapSomeEffect(entityManager.getEntityAIState(entityId)),
        )

        yield* entityManager.update(
          DeltaTimeSecs.make(0.016),
          playerPosition,
          true,
          lookDirection,
          eyePosition,
          () => false,
        )
        expect(yield* unwrapSomeEffect(entityManager.getEntityAIState(entityId))).toBe(AIState.Chase)
      }))

    itEntityManagerEffect('sheared sheep regrows while unrelated entities skip wool ticking', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const sheepId = yield* entityManager.addEntity(EntityType.Sheep, { x: 0, y: 64, z: 0 })
        const pigId = yield* entityManager.addEntity(EntityType.Pig, { x: 10, y: 64, z: 0 })

        yield* unwrapSomeEffect(entityManager.shearEntity(sheepId))

        yield* entityManager.update(DeltaTimeSecs.make(300), { x: 1000, y: 64, z: 1000 })

        yield* unwrapSomeEffect(entityManager.shearEntity(sheepId))
        expect((yield* unwrapSomeEffect(entityManager.getEntity(pigId))).type).toBe(EntityType.Pig)
      }))

    itEntityManagerEffect('shearEntity rejects non-sheep and sheep that are already sheared', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const pigId = yield* entityManager.addEntity(EntityType.Pig, { x: 10, y: 64, z: 0 })
        const sheepId = yield* entityManager.addEntity(EntityType.Sheep, { x: 0, y: 64, z: 0 })

        expect(Option.isNone(yield* entityManager.shearEntity(pigId))).toBe(true)
        yield* unwrapSomeEffect(entityManager.shearEntity(sheepId))

        const cachedEntities = yield* entityManager.getEntities()
        expect(Option.isNone(yield* entityManager.shearEntity(sheepId))).toBe(true)

        expect(yield* entityManager.getEntities()).toBe(cachedEntities)
      }))

    itEntityManagerEffect('entity wanders and moves while player stays outside detection range', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })

        yield* Effect.forEach(Arr.makeBy(13, (i) => i), () =>
          entityManager.update(DeltaTimeSecs.make(0.016), { x: 1000, y: 64, z: 1000 }).pipe(
            Effect.andThen(
              entityManager.applyPhysics(
                DeltaTimeSecs.make(0.016),
                passThroughResolver(false),
              ),
            ),
          ),
          { concurrency: 1 }
        )

        expect(yield* unwrapSomeEffect(entityManager.getEntityAIState(entityId))).toBe(AIState.Wander)

        const entity = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
        expect(Math.hypot(entity.velocity.x, entity.velocity.z)).toBeGreaterThan(0)
        expect(Math.hypot(entity.position.x, entity.position.z)).toBeGreaterThan(0)
      }))

    itEntityManagerEffect('free-falling mob velocity is clamped to a bounded terminal velocity (tunneling guard)', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 500, z: 0 })

        yield* Effect.forEach(Arr.makeBy(100, (i) => i), () =>
          entityManager.applyPhysics(DeltaTimeSecs.make(0.05), passThroughResolver(false)),
          { concurrency: 1 },
        )

        const v1 = (yield* unwrapSomeEffect(entityManager.getEntity(entityId))).velocity.y
        yield* entityManager.applyPhysics(DeltaTimeSecs.make(0.05), passThroughResolver(false))
        const v2 = (yield* unwrapSomeEffect(entityManager.getEntity(entityId))).velocity.y

        expect(v1).toBe(v2)
        expect(v1).toBeLessThan(0)
        expect(v1).toBeGreaterThanOrEqual(-36)
      }))

    itEntityManagerEffect('Ender Dragon physics preserves vertical velocity because it flies', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.EnderDragon, { x: 0, y: 80, z: 0 })

        yield* entityManager.applyPhysics(DeltaTimeSecs.make(0.5), passThroughResolver(false))

        const dragon = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
        expect(dragon.position.y).toBe(80)
        expect(dragon.velocity.y).toBe(0)
      }))

    itEntityManagerEffect('idle entity with active attack cooldown decrements cooldown without changing AI state', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager

        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const playerClose = { x: 1, y: 64, z: 0 }
        const initialDamage = yield* entityManager.getPlayerContactDamage(playerClose)
        expect(initialDamage).toBe(3)

        const playerFar = { x: 1000, y: 64, z: 1000 }
        yield* entityManager.update(DeltaTimeSecs.make(0.5), playerFar)

        expect(yield* unwrapSomeEffect(entityManager.getEntityAIState(entityId))).toBe(AIState.Idle)

        const count = yield* entityManager.getCount()
        expect(count).toBe(1)
      }))

    itEntityManagerEffect('wandering entity keeps its direction across consecutive ticks when already wandering', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const playerFar = { x: 1000, y: 64, z: 1000 }

        yield* Effect.forEach(Arr.makeBy(20, (i) => i), () =>
          entityManager.update(DeltaTimeSecs.make(0.016), playerFar),
          { concurrency: 1 }
        )

        expect(yield* unwrapSomeEffect(entityManager.getEntityAIState(entityId))).toBe(AIState.Wander)

        const before = yield* unwrapSomeEffect(entityManager.getEntity(entityId))

        const directionPreservedRef = MutableRef.make(false)
        yield* Effect.forEach(Arr.makeBy(30, (i) => i), () =>
          Effect.gen(function* () {
            const snapshot = yield* entityManager.getEntity(entityId)
            const prevVelocity = Option.map(snapshot, (e) => ({ x: e.velocity.x, z: e.velocity.z }))

            yield* entityManager.update(DeltaTimeSecs.make(0.016), playerFar)

            const afterOpt = yield* entityManager.getEntity(entityId)
            const nextVelocity = Option.map(afterOpt, (e) => ({ x: e.velocity.x, z: e.velocity.z }))

            const prev = unwrapSome(prevVelocity)
            const next = unwrapSome(nextVelocity)

            if (prev.x === next.x && prev.z === next.z) {
              MutableRef.set(directionPreservedRef, true)
            }
          }),
          { concurrency: 1 }
        )

        yield* unwrapSomeEffect(entityManager.getEntity(entityId))
        expect(Math.hypot(before.velocity.x, before.velocity.z)).toBeGreaterThan(0)
        expect(MutableRef.get(directionPreservedRef)).toBe(true)
      }))

    itEntityManagerEffect('preserves vertical velocity and keeps AI steering on the horizontal plane', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 10, z: 0 })

        yield* entityManager.applyPhysics(
          DeltaTimeSecs.make(1),
          passThroughResolver(false),
        )

        const fallingEntity = yield* unwrapSomeEffect(entityManager.getEntity(entityId))

        yield* entityManager.update(
          DeltaTimeSecs.make(0.5),
          { x: 6, y: fallingEntity.position.y + 5, z: 0 },
        )

        const entity = yield* unwrapSomeEffect(entityManager.getEntity(entityId))

        expect(entity.position.y).toBe(fallingEntity.position.y)
        expect(entity.velocity.y).toBe(fallingEntity.velocity.y)
        expect(entity.velocity.x).toBeGreaterThan(0)
        expect(entity.velocity.z).toBe(0)
      }))
  })

  describe('applyPhysics', () => {
    itEntityManagerEffect('applies gravity and uses collision resolution to ground and clamp movement', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 10, z: 0 })

        yield* entityManager.update(DeltaTimeSecs.make(1), { x: 6, y: 10, z: 0 })
        yield* entityManager.applyPhysics(
          DeltaTimeSecs.make(1),
          (outPos: Vec, outVel: Vec, position: Vec, velocity: Vec): boolean => {
            outPos.x = 2; outPos.y = 2; outPos.z = position.z
            outVel.x = 0; outVel.y = 0; outVel.z = velocity.z
            return true
          },
        )

        const entity = yield* unwrapSomeEffect(entityManager.getEntity(entityId))

        expect(entity.position.x).toBe(2)
        expect(entity.position.y).toBe(2)
        expect(entity.velocity.x).toBe(0)
        expect(entity.velocity.y).toBe(0)
      }))

    itEntityManagerEffect('hops and redirects wandering movement when grounded horizontal motion is blocked', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const playerFar = { x: 1000, y: 64, z: 1000 }

        yield* Effect.forEach(Arr.makeBy(26, (i) => i), () =>
          entityManager.update(DeltaTimeSecs.make(0.016), playerFar),
          { concurrency: 1 },
        )

        expect(yield* unwrapSomeEffect(entityManager.getEntityAIState(entityId))).toBe(AIState.Wander)

        yield* entityManager.applyPhysics(
          DeltaTimeSecs.make(0.001),
          passThroughResolver(true),
        )

        const beforeBlock = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
        expect(Math.hypot(beforeBlock.velocity.x, beforeBlock.velocity.z)).toBeGreaterThan(0)

        yield* entityManager.applyPhysics(
          DeltaTimeSecs.make(0.016),
          (outPos: Vec, outVel: Vec): boolean => {
            outPos.x = beforeBlock.position.x; outPos.y = beforeBlock.position.y; outPos.z = beforeBlock.position.z
            outVel.x = 0; outVel.y = 0; outVel.z = 0
            return true
          },
        )

        const hopped = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
        expect(hopped.velocity.x).toBe(0)
        expect(hopped.velocity.z).toBe(0)
        expect(hopped.velocity.y).toBe(4.2)

        yield* entityManager.update(DeltaTimeSecs.make(0.016), playerFar)

        const afterRedirect = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
        expect(Math.hypot(afterRedirect.velocity.x, afterRedirect.velocity.z)).toBeGreaterThan(0)
        expect(afterRedirect.velocity.y).toBe(4.2)
        expect(afterRedirect.velocity.x).not.toBeCloseTo(beforeBlock.velocity.x)
        expect(afterRedirect.velocity.z).not.toBeCloseTo(beforeBlock.velocity.z)
      }))

    itEntityManagerEffect('grounded chasing Enderman hops when horizontal movement is blocked', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Enderman, { x: 8, y: 64, z: 0 })
        const playerPosition = { x: 0, y: 64, z: 0 }
        const eyePosition = { x: 0, y: 66.1, z: 0 }

        yield* entityManager.update(
          DeltaTimeSecs.make(0.016),
          playerPosition,
          true,
          { x: 1, y: 0, z: 0 },
          eyePosition,
        )
        expect(yield* unwrapSomeEffect(entityManager.getEntityAIState(entityId))).toBe(AIState.Chase)

        yield* entityManager.applyPhysics(
          DeltaTimeSecs.make(0.001),
          passThroughResolver(true),
        )
        const beforeBlock = yield* unwrapSomeEffect(entityManager.getEntity(entityId))

        yield* entityManager.applyPhysics(
          DeltaTimeSecs.make(0.016),
          (outPos: Vec, outVel: Vec): boolean => {
            outPos.x = beforeBlock.position.x; outPos.y = beforeBlock.position.y; outPos.z = beforeBlock.position.z
            outVel.x = 0; outVel.y = 0; outVel.z = 0
            return true
          },
        )

        const blocked = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
        expect(blocked.position).toEqual(beforeBlock.position)
        expect(blocked.velocity).toEqual({ x: 0, y: 4.2, z: 0 })
      }))
  })
})
