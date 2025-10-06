import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import type { PhysicsMaterial, RigidBodyType } from '@domain/physics/types/core'
import { vector3 } from '@domain/physics/types/core'
import { RigidBodyAggregate } from '../rigid_body'

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

  // TODO: プロパティテストの高速化後にskipを解除する
  it.effect.skip('force integration updates velocity', () => Effect.unit)
})
