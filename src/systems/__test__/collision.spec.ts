import { Effect, Layer, Ref, HashMap, HashSet } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { AABB } from '@/domain/geometry'
import { EntityId } from '@/domain/entity'
import { SpatialGridService } from '@/runtime/services'
import { World, WorldLive } from '@/runtime/world'
import { collisionSystem } from '../collision'
import { SpatialGrid } from '@/infrastructure/spatial-grid'
import { playerColliderQuery } from '@/domain/queries'
import { Position } from '@/domain/components'

class MockSpatialGrid implements SpatialGrid {
  state = Ref.unsafeMake(HashMap.empty<string, HashSet.HashSet<EntityId>>())
  constructor(private readonly entities: EntityId[]) {}
  readonly register = (_entityId: EntityId, _aabb: AABB) => Effect.void
  readonly query = (_aabb: AABB) => Effect.succeed(this.entities)
  readonly clear = Effect.void
}

const setupWorld = (playerPosition: { x: number; y: number; z: number }, playerVelocity: { dx: number; dy: number; dz: number }) =>
  Effect.gen(function* (_) {
    const world = yield* _(World)
    const playerArchetype = createArchetype({
      type: 'player',
      pos: playerPosition,
    })
    const playerId = yield* _(world.addArchetype(playerArchetype))
    yield* _(world.updateComponent(playerId, 'velocity', playerVelocity))

    const blockArchetype = createArchetype({
      type: 'block',
      pos: { x: 0, y: -1, z: 0 },
      blockType: 'stone',
    })
    const blockId = yield* _(world.addArchetype(blockArchetype))

    return { playerId, blockId }
  })

describe('collisionSystem', () => {
  it('should resolve collision with ground', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const { playerId, blockId } = yield* _(setupWorld({ x: 0, y: 0, z: 0 }, { dx: 0, dy: -1, dz: 0 }))

      const MockSpatialGridLayer = Layer.succeed(SpatialGridService, new MockSpatialGrid([playerId, blockId]))
      const system = collisionSystem.pipe(Effect.provide(MockSpatialGridLayer))

      yield* _(system)

      const player = (yield* _(world.query(playerColliderQuery)))[0]!
      expect(player.position.y).toBe(0) // block y is -1, block height is 1, player height is 2. so player pos y should be 0
      expect(player.velocity.dy).toBe(0)
      expect(player.player.isGrounded).toBe(true)
    })

    await Effect.runPromise(Effect.provide(program, WorldLive))
  })

  it('should resolve collision with a wall on the X axis', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const { playerId, blockId } = yield* _(setupWorld({ x: 0.6, y: 0, z: 0 }, { dx: 1, dy: 0, dz: 0 }))
      yield* _(world.updateComponent(blockId, 'position', { x: 2, y: 0, z: 0 }))

      const MockSpatialGridLayer = Layer.succeed(SpatialGridService, new MockSpatialGrid([playerId, blockId]))
      const system = collisionSystem.pipe(Effect.provide(MockSpatialGridLayer))

      yield* _(system)

      const player = (yield* _(world.query(playerColliderQuery)))[0]!
      expect(player.position.x).toBeLessThan(2 - 0.5 / 2)
      expect(player.velocity.dx).toBe(0)
    })

    await Effect.runPromise(Effect.provide(program, WorldLive))
  })

  it('should resolve collision with a wall on the Z axis', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const { playerId, blockId } = yield* _(setupWorld({ x: 0, y: 0, z: 0.6 }, { dx: 0, dy: 0, dz: 1 }))
      yield* _(world.updateComponent(blockId, 'position', { x: 0, y: 0, z: 2 }))

      const MockSpatialGridLayer = Layer.succeed(SpatialGridService, new MockSpatialGrid([playerId, blockId]))
      const system = collisionSystem.pipe(Effect.provide(MockSpatialGridLayer))

      yield* _(system)

      const player = (yield* _(world.query(playerColliderQuery)))[0]!
      expect(player.position.z).toBeLessThan(2 - 0.5 / 2)
      expect(player.velocity.dz).toBe(0)
    })

    await Effect.runPromise(Effect.provide(program, WorldLive))
  })

  it('should not collide if there are no nearby entities', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const { playerId } = yield* _(setupWorld({ x: 0, y: 10, z: 0 }, { dx: 1, dy: 1, dz: 1 }))

      const MockSpatialGridLayer = Layer.succeed(SpatialGridService, new MockSpatialGrid([playerId]))
      const system = collisionSystem.pipe(Effect.provide(MockSpatialGridLayer))

      const initialPlayer = (yield* _(world.query(playerColliderQuery)))[0]!
      yield* _(system)
      const finalPlayer = (yield* _(world.query(playerColliderQuery)))[0]!

      const expectedPosition = new Position({
        x: initialPlayer.position.x,
        y: initialPlayer.position.y,
        z: initialPlayer.position.z,
      })
      expect(finalPlayer.position).toEqual(expectedPosition)
      expect(finalPlayer.velocity).toEqual(initialPlayer.velocity)
    })

    await Effect.runPromise(Effect.provide(program, WorldLive))
  })
})