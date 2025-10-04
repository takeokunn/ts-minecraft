import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import * as fc from 'effect/FastCheck'
import { RigidBodyAggregate } from '../rigid_body'
import { vector3 } from '../../types/core'
import type { RigidBodyType, PhysicsMaterial } from '../../types/core'

describe('RigidBodyAggregate', () => {
  const bodyType: RigidBodyType = 'dynamic'
  const material: PhysicsMaterial = 'stone'

  const creation = {
    worldId: 'world-abcdef',
    entityId: 'player-1',
    bodyType,
    material,
    mass: 80,
    position: vector3({ x: 0, y: 5, z: 0 }),
  }

  it.effect('creates rigid body', () =>
    Effect.map(RigidBodyAggregate.create(creation), (body) => {
      expect(body.mass).toBeGreaterThan(0)
    })
  )

  it.effect('applies force', () =>
    Effect.gen(function* () {
      const body = yield* RigidBodyAggregate.create(creation)
      const moved = yield* RigidBodyAggregate.applyForce(body, vector3({ x: 0, y: -9.8, z: 0 }), 0.1)
      expect(moved.motion.velocity.y).toBeLessThan(body.motion.velocity.y)
    })
  )

  it.effect.prop('force integration updates velocity', [fc.float({ min: -5, max: 5 })], ([forceY]) =>
    Effect.gen(function* () {
      const body = yield* RigidBodyAggregate.create(creation)
      const moved = yield* RigidBodyAggregate.applyForce(
        body,
        vector3({ x: 0, y: forceY, z: 0 }),
        0.05
      )
      expect(moved.motion.velocity.y - body.motion.velocity.y).toBeCloseTo(forceY / body.mass * 0.05)
    })
  )
})
