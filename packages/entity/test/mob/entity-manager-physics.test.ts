import { DeltaTimeSecs, zero } from '@ts-minecraft/core'
import { MutableRef } from 'effect'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { AIState } from '@ts-minecraft/entity/domain/mob/state-machine';
import { describe, expect, it } from 'vitest'
import { prepareEntityPhysicsFrame } from '../../application/mob/entity-manager-physics-frame'
import { processEntityPhysics } from '../../application/mob/entity-manager-physics'
import { shouldReuseEntityPhysicsFrame } from '../../application/mob/entity-manager-physics-reuse'
import { makeTestManagedEntity } from './test-utils'

describe('entity/entityManagerPhysics', () => {
  it('reuses only an unchanged physics frame', () => {
    const entity = makeTestManagedEntity({
      type: EntityType.EnderDragon,
      position: zero,
      velocity: zero,
      wanderDirection: zero,
      isGrounded: false,
      stuckTicks: 0,
    })

    expect(shouldReuseEntityPhysicsFrame(entity, {
      position: zero,
      velocity: zero,
      wanderDirection: zero,
      isGrounded: false,
      stuckTicks: 0,
    })).toBe(true)
  })

  it('rejects reuse when the physics frame changes', () => {
    const entity = makeTestManagedEntity({
      type: EntityType.EnderDragon,
      position: zero,
      velocity: zero,
      wanderDirection: zero,
      isGrounded: false,
      stuckTicks: 0,
    })

    expect(shouldReuseEntityPhysicsFrame(entity, {
      position: zero,
      velocity: zero,
      wanderDirection: zero,
      isGrounded: false,
      stuckTicks: 1,
    })).toBe(false)
  })

  it('prepares a hopping physics frame from the collision result', () => {
    const entity = makeTestManagedEntity({
      entityId: EntityId.make('entity-physics-hop'),
      type: EntityType.Enderman,
      aiState: AIState.Chase,
      position: { x: 0, y: 64, z: 0 },
      velocity: { x: 1, y: 0, z: 0 },
      wanderDirection: zero,
      isGrounded: true,
      stuckTicks: 2,
    })

    const frame = prepareEntityPhysicsFrame(entity, entity.entityId, {
      tick: 12,
      deltaTime: DeltaTimeSecs.make(0.001),
      resolveCollision: (outPos, outVel, position, velocity) => {
        outPos.x = position.x
        outPos.y = position.y
        outPos.z = position.z
        outVel.x = 0
        outVel.y = velocity.y
        outVel.z = 0
        return true
      },
    })

    expect(frame.position.x).toBeCloseTo(0.001)
    expect(frame.position.y).toBeCloseTo(63.99999018)
    expect(frame.position.z).toBeCloseTo(0)
    expect(frame.velocity).toEqual({ x: 0, y: 4.2, z: 0 })
    expect(frame.isGrounded).toBe(true)
    expect(frame.stuckTicks).toBe(3)
    expect(frame.wanderDirection).not.toEqual(entity.wanderDirection)
  })

  it('returns the same entity when physics does not change anything', () => {
    const entity = makeTestManagedEntity({
      type: EntityType.EnderDragon,
      position: zero,
      velocity: zero,
      wanderDirection: zero,
      isGrounded: false,
      stuckTicks: 0,
    })
    const dirtyRef = MutableRef.make(false)

    const next = processEntityPhysics(entity, entity.entityId, {
      tick: 1,
      deltaTime: DeltaTimeSecs.make(1),
      resolveCollision: (outPos, outVel, position, velocity) => {
        outPos.x = position.x
        outPos.y = position.y
        outPos.z = position.z
        outVel.x = velocity.x
        outVel.y = velocity.y
        outVel.z = velocity.z
        return false
      },
    }, dirtyRef)

    expect(next).toBe(entity)
    expect(MutableRef.get(dirtyRef)).toBe(false)
  })
})
