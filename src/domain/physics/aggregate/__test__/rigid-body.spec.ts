import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { RigidBodyAggregate } from '../rigid-body'
import {
  PhysicsWorldIdSchema,
  RigidBodySchema,
  vector3,
  decodeWith,
} from '../../types/core'

const worldId = Effect.runSync(decodeWith(PhysicsWorldIdSchema)('world-0001'))

const run = <A>(program: Effect.Effect<A>) => Effect.runPromise(program)

const makeRigidBody = async () =>
  run(
    RigidBodyAggregate.create({
      worldId,
      entityId: 'entity-001',
      bodyType: 'dynamic',
      material: 'stone',
      mass: 5,
      position: vector3({ x: 0, y: 10, z: 0 }),
      restitution: 0.4,
      friction: 0.6,
    })
  )

describe('physics/aggregate/rigid_body', () => {
  it('creates rigid body with defaults and brands', async () => {
    const body = await makeRigidBody()
    const validated = await run(decodeWith(RigidBodySchema)(body))
    expect(validated.worldId).toBe(body.worldId)
    expect(validated.motion.position.y).toBe(10)
    expect(validated.friction).toBeCloseTo(0.6)
  })

  it('updates motion when force is applied', async () => {
    const body = await makeRigidBody()
    const updated = await run(
      RigidBodyAggregate.applyForce(body, vector3({ x: 0, y: -9.81, z: 0 }), 0.1)
    )
    expect(updated.motion.velocity.y).toBeLessThan(body.motion.velocity.y)
    expect(updated.motion.position.y).toBeLessThan(body.motion.position.y)
  })

  it('dampens velocity on touchGround for movable bodies', async () => {
    const body = await makeRigidBody()
    const moving = await run(
      RigidBodyAggregate.updateMotion(
        body,
        vector3({ x: 0, y: 1, z: 0 }),
        vector3({ x: 2, y: -3, z: 1 })
      )
    )
    const grounded = await run(RigidBodyAggregate.touchGround(moving))
    expect(Math.abs(grounded.motion.velocity.x)).toBeLessThanOrEqual(1e-6)
    expect(Math.abs(grounded.motion.velocity.y)).toBeLessThanOrEqual(1e-6)
    expect(Math.abs(grounded.motion.velocity.z)).toBeLessThanOrEqual(1e-6)
  })
})
