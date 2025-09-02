import { Effect, Layer, Ref, HashMap, HashSet } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { AABB, createAABB } from '@/domain/geometry'
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

const setupWorld = (
  playerPosition: { x: number; y: number; z: number },
  playerVelocity: { dx: number; dy: number; dz: number },
  blockPositions: { x: number; y: number; z: number }[] = [{ x: 0, y: -1, z: 0 }],
) =>
  Effect.gen(function* (_) {
    const world = yield* _(World)
    const playerArchetype = createArchetype({
      type: 'player',
      pos: playerPosition,
    })
    const playerId = yield* _(world.addArchetype(playerArchetype))
    yield* _(world.updateComponent(playerId, 'velocity', playerVelocity))

    const blockIds: EntityId[] = []
    for (const pos of blockPositions) {
      const blockArchetype = createArchetype({
        type: 'block',
        pos,
        blockType: 'stone',
      })
      const blockId = yield* _(world.addArchetype(blockArchetype))
      blockIds.push(blockId)
    }

    return { playerId, blockIds }
  })

describe('collisionSystem', () => {
  it('should resolve collision with ground', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      // Player is above the block, moving down, and already intersecting
      const { playerId, blockIds } = yield* _(setupWorld({ x: 0, y: 0, z: 0 }, { dx: 0, dy: -1, dz: 0 }, [{ x: 0, y: -1, z: 0 }]))
      const MockSpatialGridLayer = Layer.succeed(SpatialGridService, new MockSpatialGrid([playerId, ...blockIds]))
      const system = collisionSystem.pipe(Effect.provide(MockSpatialGridLayer))
      yield* _(system)
      const player = (yield* _(world.query(playerColliderQuery)))[0]!
      const playerCollider = player.collider
      const blockAABB = createAABB({ x: 0, y: -1, z: 0 }, { width: 1, height: 1, depth: 1 })

      // Player's feet should be on top of the block
      expect(player.position.y).toBeCloseTo(blockAABB.maxY + playerCollider.height / 2)
      expect(player.velocity.dy).toBeCloseTo(0)
      expect(player.player.isGrounded).toBe(true)
    })
    await Effect.runPromise(Effect.provide(program, WorldLive))
  })

  it('should resolve collision with ceiling', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      // Player is below the block, moving up, and already intersecting
      const { playerId, blockIds } = yield* _(setupWorld({ x: 0, y: -0.6, z: 0 }, { dx: 0, dy: 1, dz: 0 }, [{ x: 0, y: 0, z: 0 }]))
      const MockSpatialGridLayer = Layer.succeed(SpatialGridService, new MockSpatialGrid([playerId, ...blockIds]))
      const system = collisionSystem.pipe(Effect.provide(MockSpatialGridLayer))
      yield* _(system)
      const player = (yield* _(world.query(playerColliderQuery)))[0]!
      const playerCollider = player.collider
      const blockAABB = createAABB({ x: 0, y: 0, z: 0 }, { width: 1, height: 1, depth: 1 })

      // Player's head should be at the bottom of the block
      expect(player.position.y).toBeCloseTo(blockAABB.minY - playerCollider.height / 2)
      expect(player.velocity.dy).toBeCloseTo(0)
    })
    await Effect.runPromise(Effect.provide(program, WorldLive))
  })

  it('should resolve collision with a wall on the X-axis', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      // Player is intersecting the block from the left, moving right
      const { playerId, blockIds } = yield* _(setupWorld({ x: -0.4, y: 0, z: 0 }, { dx: 1, dy: 0, dz: 0 }, [{ x: 0, y: 0, z: 0 }]))
      const MockSpatialGridLayer = Layer.succeed(SpatialGridService, new MockSpatialGrid([playerId, ...blockIds]))
      const system = collisionSystem.pipe(Effect.provide(MockSpatialGridLayer))
      yield* _(system)
      const player = (yield* _(world.query(playerColliderQuery)))[0]!
      const playerCollider = player.collider
      const blockAABB = createAABB({ x: 0, y: 0, z: 0 }, { width: 1, height: 1, depth: 1 })

      // Player should be pushed out to the left of the block
      expect(player.position.x).toBeCloseTo(blockAABB.minX - playerCollider.width / 2)
      expect(player.velocity.dx).toBeCloseTo(0)
    })
    await Effect.runPromise(Effect.provide(program, WorldLive))
  })

  it('should resolve collision with a wall on the negative X-axis', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      // Player is intersecting the block from the right, moving left
      const { playerId, blockIds } = yield* _(setupWorld({ x: 0.4, y: 0, z: 0 }, { dx: -1, dy: 0, dz: 0 }, [{ x: 0, y: 0, z: 0 }]))
      const MockSpatialGridLayer = Layer.succeed(SpatialGridService, new MockSpatialGrid([playerId, ...blockIds]))
      const system = collisionSystem.pipe(Effect.provide(MockSpatialGridLayer))
      yield* _(system)
      const player = (yield* _(world.query(playerColliderQuery)))[0]!
      const playerCollider = player.collider
      const blockAABB = createAABB({ x: 0, y: 0, z: 0 }, { width: 1, height: 1, depth: 1 })

      // Player should be pushed out to the right of the block
      expect(player.position.x).toBeCloseTo(blockAABB.maxX + playerCollider.width / 2)
      expect(player.velocity.dx).toBeCloseTo(0)
    })
    await Effect.runPromise(Effect.provide(program, WorldLive))
  })

  it('should resolve collision with a wall on the Z-axis', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      // Player is intersecting the block from the back, moving forward
      const { playerId, blockIds } = yield* _(setupWorld({ x: 0, y: 0, z: -0.4 }, { dx: 0, dy: 0, dz: 1 }, [{ x: 0, y: 0, z: 0 }]))
      const MockSpatialGridLayer = Layer.succeed(SpatialGridService, new MockSpatialGrid([playerId, ...blockIds]))
      const system = collisionSystem.pipe(Effect.provide(MockSpatialGridLayer))
      yield* _(system)
      const player = (yield* _(world.query(playerColliderQuery)))[0]!
      const playerCollider = player.collider
      const blockAABB = createAABB({ x: 0, y: 0, z: 0 }, { width: 1, height: 1, depth: 1 })

      // Player should be pushed out to the back of the block
      expect(player.position.z).toBeCloseTo(blockAABB.minZ - playerCollider.depth / 2)
      expect(player.velocity.dz).toBeCloseTo(0)
    })
    await Effect.runPromise(Effect.provide(program, WorldLive))
  })

  it('should resolve collision with a wall on the negative Z-axis', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      // Player is intersecting the block from the front, moving back
      const { playerId, blockIds } = yield* _(setupWorld({ x: 0, y: 0, z: 0.4 }, { dx: 0, dy: 0, dz: -1 }, [{ x: 0, y: 0, z: 0 }]))
      const MockSpatialGridLayer = Layer.succeed(SpatialGridService, new MockSpatialGrid([playerId, ...blockIds]))
      const system = collisionSystem.pipe(Effect.provide(MockSpatialGridLayer))
      yield* _(system)
      const player = (yield* _(world.query(playerColliderQuery)))[0]!
      const playerCollider = player.collider
      const blockAABB = createAABB({ x: 0, y: 0, z: 0 }, { width: 1, height: 1, depth: 1 })

      // Player should be pushed out to the front of the block
      expect(player.position.z).toBeCloseTo(blockAABB.maxZ + playerCollider.depth / 2)
      expect(player.velocity.dz).toBeCloseTo(0)
    })
    await Effect.runPromise(Effect.provide(program, WorldLive))
  })

  it('should slide along a wall when moving diagonally', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      // Player is moving towards a corner and intersects the X-face first
      const { playerId, blockIds } = yield* _(setupWorld({ x: -0.4, y: 0, z: 0.6 }, { dx: 1, dy: 0, dz: -1 }, [{ x: 0, y: 0, z: 0 }]))
      const MockSpatialGridLayer = Layer.succeed(SpatialGridService, new MockSpatialGrid([playerId, ...blockIds]))
      const system = collisionSystem.pipe(Effect.provide(MockSpatialGridLayer))
      yield* _(system)
      const player = (yield* _(world.query(playerColliderQuery)))[0]!
      const playerCollider = player.collider
      const blockAABB = createAABB({ x: 0, y: 0, z: 0 }, { width: 1, height: 1, depth: 1 })

      // Position is corrected for X-axis, velocity.dx is zeroed
      expect(player.position.x).toBeCloseTo(blockAABB.minX - playerCollider.width / 2)
      expect(player.velocity.dx).toBeCloseTo(0)
      // Position is also corrected for Z-axis because the initial position causes intersection on both axes after X-correction
      expect(player.position.z).toBeCloseTo(blockAABB.maxZ + playerCollider.depth / 2)
      expect(player.velocity.dz).toBeCloseTo(0)
    })
    await Effect.runPromise(Effect.provide(program, WorldLive))
  })

  it('should not collide if there are no nearby entities', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const { playerId } = yield* _(setupWorld({ x: 0, y: 10, z: 0 }, { dx: 1, dy: 1, dz: 1 }, []))
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

  it('should do nothing if no player exists', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const { blockIds } = yield* _(setupWorld({ x: 0, y: 0, z: 0 }, { dx: 0, dy: 0, dz: 0 }, []))
      yield* _(world.query(playerColliderQuery).pipe(Effect.flatMap((players) => Effect.forEach(players, (p) => world.removeEntity(p.entityId)))))

      const MockSpatialGridLayer = Layer.succeed(SpatialGridService, new MockSpatialGrid([...blockIds]))
      const system = collisionSystem.pipe(Effect.provide(MockSpatialGridLayer))

      const initialWorldState = yield* _(world.state.get)
      yield* _(system)
      const finalWorldState = yield* _(world.state.get)

      expect(finalWorldState).toEqual(initialWorldState)
    })
    await Effect.runPromise(Effect.provide(program, WorldLive))
  })
})
