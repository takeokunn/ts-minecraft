import { epochMillis, physicsWorldId, vector3 } from '@domain/physics/types/core'
import { PhysicsError } from '@domain/physics/types/errors'
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { RigidBodyFactory } from '../rigid_body_factory'

const staticVector = vector3({ x: 0, y: 10, z: 0 })
const defaultWorld = physicsWorldId('world-12345678')

const run = <A>(effect: Effect.Effect<A>) => Effect.runSync(effect)

describe('RigidBodyFactory', () => {
  it('creates rigid body with defaults', () => {
    const body = run(
      RigidBodyFactory.create({
        worldId: defaultWorld,
        entityId: 'entity-1',
        bodyType: 'dynamic',
        material: 'metal',
        mass: 5,
        position: staticVector,
      })
    )

    expect(body.worldId).toBe(defaultWorld)
    expect(body.entityId).toBe('entity-1')
    expect(body.bodyType).toBe('dynamic')
    expect(body.mass).toBe(5)
    expect(body.motion.position).toEqual(staticVector)
    expect(body.restitution).toBeGreaterThanOrEqual(0)
    expect(body.restitution).toBeLessThanOrEqual(1)
    expect(body.friction).toBeGreaterThanOrEqual(0)
    expect(body.friction).toBeLessThanOrEqual(1)
    expect(body.createdAt).toBeGreaterThanOrEqual(epochMillis(0))
    expect(body.updatedAt).toBeGreaterThanOrEqual(body.createdAt)
  })

  it('supports varying masses and friction input', () => {
    const lightBody = run(
      RigidBodyFactory.create({
        worldId: defaultWorld,
        entityId: 'entity-2',
        bodyType: 'dynamic',
        material: 'wood',
        mass: 0.5,
        friction: 0.1,
        restitution: 0.9,
        position: vector3({ x: 1, y: 2, z: 3 }),
      })
    )

    expect(lightBody.mass).toBeCloseTo(0.5)
    expect(lightBody.friction).toBeCloseTo(0.1)
    expect(lightBody.restitution).toBeCloseTo(0.9)

    const heavyBody = run(
      RigidBodyFactory.create({
        worldId: defaultWorld,
        entityId: 'entity-3',
        bodyType: 'static',
        material: 'stone',
        mass: 1000,
        position: vector3({ x: -3, y: 0, z: 4 }),
      })
    )

    expect(heavyBody.mass).toBeCloseTo(1000)
    expect(heavyBody.motion.velocity).toEqual(vector3({ x: 0, y: 0, z: 0 }))
  })

  it('fails when mass is invalid', () => {
    const result = Effect.runSyncExit(
      RigidBodyFactory.create({
        worldId: defaultWorld,
        entityId: 'entity-4',
        bodyType: 'dynamic',
        material: 'metal',
        mass: -1,
        position: staticVector,
      })
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = result.cause.value as PhysicsError
      expect(error._tag).toBe('SchemaViolation')
    }
  })
})
