import { describe } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { DeltaTimeSecs, type Position } from '@ts-minecraft/core'
import { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import { EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { nearestPlayerPosition } from '../../application/mob/entity-manager-ai-frame'
import { itEntityManagerEffect, expectSome } from './test-utils'

const FAR_AWAY: Position = { x: 500, y: 64, z: 500 } as Position

describe('entity/multiPlayerTargeting', () => {
  describe('nearestPlayerPosition', () => {
    itEntityManagerEffect('falls back to the local player without remotes', () =>
      Effect.sync(() => {
        const entityPos = { x: 0, y: 64, z: 0 } as Position
        expect(nearestPlayerPosition(entityPos, FAR_AWAY, undefined)).toBe(FAR_AWAY)
        expect(nearestPlayerPosition(entityPos, FAR_AWAY, [])).toBe(FAR_AWAY)
      }))

    itEntityManagerEffect('picks the closest of local + remote players', () =>
      Effect.sync(() => {
        const entityPos = { x: 0, y: 64, z: 0 } as Position
        const near = { x: 3, y: 64, z: 0 } as Position
        const mid = { x: 30, y: 64, z: 0 } as Position
        expect(nearestPlayerPosition(entityPos, FAR_AWAY, [mid, near])).toBe(near)
        expect(nearestPlayerPosition(entityPos, near, [FAR_AWAY])).toBe(near)
      }))
  })

  describe('hostile AI vs co-op peers', () => {
    itEntityManagerEffect('chases a remote player when the local player is out of range', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const remotePlayer = { x: 6, y: 64, z: 0 } as Position

        yield* entityManager.update(
          DeltaTimeSecs.make(0.05),
          FAR_AWAY,
          true,
          undefined,
          FAR_AWAY,
          undefined,
          false,
          [remotePlayer],
        )

        const entity = expectSome(yield* entityManager.getEntity(entityId))
        // Chase steering points exactly at the remote player on the +x axis;
        // a wander vector would carry a hash-random z component.
        expect(entity.velocity.x).toBeGreaterThan(0)
        expect(entity.velocity.z).toBeCloseTo(0, 5)
      }))

    itEntityManagerEffect('keeps chasing the local player when they are the nearest', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const localPlayer = { x: 6, y: 64, z: 0 } as Position

        yield* entityManager.update(
          DeltaTimeSecs.make(0.05),
          localPlayer,
          true,
          undefined,
          localPlayer,
          undefined,
          false,
          [{ x: 0, y: 64, z: -450 } as Position],
        )

        const entity = expectSome(yield* entityManager.getEntity(entityId))
        expect(entity.velocity.x).toBeGreaterThan(0)
        expect(entity.velocity.z).toBeCloseTo(0, 5)
      }))

    itEntityManagerEffect('arms a creeper fuse against a nearby remote player', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Creeper, { x: 0, y: 64, z: 0 })
        const remotePlayer = { x: 1.5, y: 64, z: 0 } as Position

        yield* entityManager.update(
          DeltaTimeSecs.make(0.1),
          FAR_AWAY,
          true,
          undefined,
          FAR_AWAY,
          undefined,
          false,
          [remotePlayer],
        )

        const entity = expectSome(yield* entityManager.getEntity(entityId))
        expect(entity.fuseSecs).toBeGreaterThan(0)
      }))
  })
})
