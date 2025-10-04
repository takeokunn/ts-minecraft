import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import { RigidBodyFactory } from '../rigid_body_factory'
import { vector3 } from '../../types/core'
import * as fc from 'effect/FastCheck'

describe('RigidBodyFactory', () => {
  it.effect('creates rigid body', () =>
    Effect.map(
      RigidBodyFactory.create({
        worldId: 'world-1',
        entityId: 'entity',
        bodyType: 'dynamic',
        material: 'stone',
        mass: 80,
        position: vector3({ x: 0, y: 2, z: 0 }),
      }),
      (body) => expect(body.motion.position.y).toBe(2)
    )
  )

  it.effect.prop('supports varying masses', [fc.float({ min: 1, max: 200 })], ([mass]) =>
    Effect.map(
      RigidBodyFactory.create({
        worldId: 'world-1',
        entityId: 'entity',
        bodyType: 'dynamic',
        material: 'stone',
        mass,
        position: vector3({ x: 0, y: 0, z: 0 }),
      }),
      (body) => expect(body.mass).toBeCloseTo(mass)
    )
  )
})
