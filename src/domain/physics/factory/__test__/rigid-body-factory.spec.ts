import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import { RigidBodyFactory } from '../rigid-body-factory'
import { vector3 } from '../../types/core'
import * as fc from 'effect/FastCheck'

describe('RigidBodyFactory', () => {
  const baseOptions = {
    worldId: 'world-1234',
    entityId: 'entity-1',
    bodyType: 'dynamic' as const,
    material: 'stone' as const,
    position: vector3({ x: 0, y: 5, z: 0 }),
  }

  it.effect('creates rigid body', () =>
    Effect.map(
      RigidBodyFactory.create({
        ...baseOptions,
        mass: 75,
      }),
      (body) => {
        expect(body.worldId).toBe(baseOptions.worldId)
        expect(body.entityId).toBe(baseOptions.entityId)
        expect(body.mass).toBeCloseTo(75, 5)
        expect(body.motion.position).toEqual(baseOptions.position)
      }
    )
  )

  const positiveMassArb = fc.float({
    min: Math.fround(0.01),
    max: Math.fround(500),
    noNaN: true,
    noDefaultInfinity: true,
  })

  it.effect.prop(
    'supports varying masses',
    [positiveMassArb],
    ([mass]) =>
      Effect.map(
        RigidBodyFactory.create({
          ...baseOptions,
          mass,
        }),
        (body) => {
          expect(body.mass).toBeCloseTo(mass, 5)
        }
      )
  )
})
