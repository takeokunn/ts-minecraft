import { describe } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Option } from 'effect'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import {
  isRemoteEntityId,
  stripRemoteEntityId,
  REMOTE_ENTITY_ID_PREFIX,
} from '@ts-minecraft/entity/domain/mob/remote-entity'
import { itEntityManagerEffect, expectSome } from './test-utils'

const remoteId = (raw: string): EntityId => EntityId.make(`${REMOTE_ENTITY_ID_PREFIX}player-host:${raw}`)

const addRemoteZombie = (position: { x: number; y: number; z: number }, raw = 'entity-42') =>
  Effect.gen(function* () {
    const entityManager = yield* EntityManager
    const entityId = remoteId(raw)
    yield* entityManager.applyEntitySnapshot({
      entityId,
      entityType: EntityType.Zombie,
      position,
      health: 20,
      alive: true,
    })
    return entityId
  })

describe('entity/remoteEntityAuthority', () => {
  describe('remote entity id helpers', () => {
    itEntityManagerEffect('recognizes and strips the remote namespace', () =>
      Effect.sync(() => {
        expect(isRemoteEntityId('remote:player-a:entity-1')).toBe(true)
        expect(isRemoteEntityId('entity-1')).toBe(false)
        expect(stripRemoteEntityId('remote:player-a:entity-1')).toBe('entity-1')
        expect(stripRemoteEntityId('entity-1')).toBeNull()
        expect(stripRemoteEntityId('remote:broken')).toBeNull()
        expect(stripRemoteEntityId('remote:player-a:')).toBeNull()
      }))
  })

  describe('AI suppression', () => {
    itEntityManagerEffect('never moves a remote entity during update (snapshot-driven)', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const start = { x: 3, y: 64, z: 0 }
        const entityId = yield* addRemoteZombie(start)

        // A player within detection range would normally trigger chase AI.
        for (let i = 0; i < 20; i++) {
          yield* entityManager.update(DeltaTimeSecs.make(0.1), { x: 5, y: 64, z: 0 })
        }

        const entity = expectSome(yield* entityManager.getEntity(entityId))
        expect(entity.position).toEqual(start)
      }))

    itEntityManagerEffect('still ticks the hostile attack cooldown on remote entities', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const playerPos = { x: 0, y: 64, z: 0 }
        yield* addRemoteZombie(playerPos)

        const first = yield* entityManager.getPlayerContactDamageResolution(playerPos)
        expect(first.damage).toBeGreaterThan(0)
        // Cooldown just armed: an immediate second resolution deals nothing.
        const second = yield* entityManager.getPlayerContactDamageResolution(playerPos)
        expect(second.damage).toBe(0)

        // The remote minimal tick must decrement the cooldown or the mob
        // could only ever hit the local player once.
        for (let i = 0; i < 12; i++) {
          yield* entityManager.update(DeltaTimeSecs.make(0.1), playerPos)
        }
        const third = yield* entityManager.getPlayerContactDamageResolution(playerPos)
        expect(third.damage).toBeGreaterThan(0)
      }))
  })

  describe('physics suppression', () => {
    itEntityManagerEffect('does not integrate velocity/gravity for remote entities', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const start = { x: 0, y: 80, z: 0 }
        const entityId = yield* addRemoteZombie(start)

        // Free-fall resolver: nothing is solid, so a local entity would drop.
        yield* entityManager.applyPhysics(
          DeltaTimeSecs.make(0.5),
          (outPos, outVel, position, velocity) => {
            outPos.x = position.x + velocity.x * 0.5
            outPos.y = position.y + velocity.y * 0.5
            outPos.z = position.z + velocity.z * 0.5
            outVel.x = velocity.x
            outVel.y = velocity.y - 5
            outVel.z = velocity.z
          },
        )

        const entity = expectSome(yield* entityManager.getEntity(entityId))
        expect(entity.position).toEqual(start)
      }))
  })

  describe('despawn exemption', () => {
    itEntityManagerEffect('excludes remote entities from distance despawn', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const farAway = { x: 10_000, y: 64, z: 10_000 }
        const remoteEntityId = yield* addRemoteZombie(farAway)
        const localEntityId = yield* entityManager.addEntity(EntityType.Zombie, farAway)

        const despawned = yield* entityManager.despawnFarEntities({ x: 0, y: 64, z: 0 }, 128)

        expect(despawned).toBe(1)
        expect(Option.isSome(yield* entityManager.getEntity(remoteEntityId))).toBe(true)
        expect(Option.isNone(yield* entityManager.getEntity(localEntityId))).toBe(true)
      }))
  })
})
