import { describe, expect, it } from 'vitest'
import { Effect, Layer, Schema } from 'effect'
import { WorldCollisionApplicationService, WorldCollisionApplicationServiceLive } from '../world-collision-service'
import { CollisionService } from '../../domain_service/collision-service'
import { CollisionResult } from '../../value_object/collision-result'
import { PhysicsWorldIdSchema, aabb, vector3 } from '../../types/core'

type CollisionQuery = Parameters<typeof CollisionResult.detect>[0]

const MockCollisionServiceLive = Layer.succeed(CollisionService, {
  detect: (query: CollisionQuery) =>
    CollisionResult.detect({
      position: query.position,
      velocity: query.velocity,
      deltaTime: query.deltaTime,
      body: query.body,
      sample: query.sample,
    }),
})

const layer = Layer.provideMerge(MockCollisionServiceLive)(WorldCollisionApplicationServiceLive)

const decodeWorldId = Schema.decodeUnknownSync(PhysicsWorldIdSchema)
const worldId = decodeWorldId('physics-0001')
const shape = aabb({
  min: vector3({ x: 0, y: 0, z: 0 }),
  max: vector3({ x: 1, y: 2, z: 1 }),
})

const runWithLayer = async <A>(effect: Effect.Effect<A>) =>
  Effect.runPromise(Effect.provide(layer)(effect))

describe('WorldCollisionApplicationService', () => {
  it('checks placement', async () => {
    const program = Effect.gen(function* () {
      const service = yield* WorldCollisionApplicationService
      return yield* service.canPlaceBlock({
        worldId,
        shape,
        position: vector3({ x: 0, y: 0, z: 0 }),
        sample: () => [],
      })
    })

    await expect(runWithLayer(program)).resolves.toBe(true)
  })

  it('placement fails when block overlaps', async () => {
    const program = Effect.gen(function* () {
      const service = yield* WorldCollisionApplicationService
      return yield* service.canPlaceBlock({
        worldId,
        shape,
        position: vector3({ x: 0, y: 0, z: 0 }),
        sample: (query) => [query],
      })
    })

    await expect(runWithLayer(program)).resolves.toBe(false)
  })

  it('simulates movement without collisions', async () => {
    const position = vector3({ x: 0, y: 1, z: 0 })
    const velocity = vector3({ x: 1, y: 0, z: -0.5 })
    const deltaTime = 0.25

    const program = Effect.gen(function* () {
      const service = yield* WorldCollisionApplicationService
      return yield* service.simulateMovement({
        worldId,
        shape,
        position,
        velocity,
        deltaTime,
        sample: () => [],
      })
    })

    const result = await runWithLayer(program)
    expect(result.position).toEqual(
      vector3({
        x: position.x + velocity.x * deltaTime,
        y: position.y + velocity.y * deltaTime,
        z: position.z + velocity.z * deltaTime,
      })
    )
    expect(result.grounded).toBe(false)
  })

  it('detects grounding when colliding vertically', async () => {
    const program = Effect.gen(function* () {
      const service = yield* WorldCollisionApplicationService
      return yield* service.simulateMovement({
        worldId,
        shape,
        position: vector3({ x: 0, y: 1, z: 0 }),
        velocity: vector3({ x: 0, y: -3, z: 0 }),
        deltaTime: 0.5,
        sample: (query) => [query],
      })
    })

    const result = await runWithLayer(program)
    expect(result.position).toEqual(vector3({ x: 0, y: 1, z: 0 }))
    expect(result.grounded).toBe(true)
  })
})
