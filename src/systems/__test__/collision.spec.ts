import { describe, it, assert } from '@effect/vitest'
import { Effect, Layer, pipe } from 'effect'
import { collisionSystem } from '../collision'
import { World, SpatialGrid } from '@/runtime/services'
import { WorldLive } from '@/infrastructure/world'
import { SpatialGridLive } from '@/infrastructure/spatial-grid'
import { createArchetype } from '@/domain/archetypes'
import { toFloat } from '@/domain/common'
import { Player, Position, Velocity, Collider } from '@/core/components'
import { createAABB } from '@/domain/geometry'

const TestLayer = Layer.mergeAll(WorldLive, SpatialGridLive)

describe('collisionSystem', () => {
  it.effect('should detect and resolve collisions between player and blocks', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      const spatialGrid = yield* _(SpatialGrid)
      
      // Create a player moving downward
      const playerArchetype = yield* _(createArchetype({
        type: 'player',
        pos: { x: 0, y: 10, z: 0 },
      }))
      const playerId = yield* _(world.addArchetype(playerArchetype))
      
      // Set player velocity (falling)
      yield* _(world.updateComponent(playerId, 'velocity', new Velocity({
        dx: toFloat(0),
        dy: toFloat(-5), // Falling
        dz: toFloat(0),
      })))
      
      // Create a block below the player
      const blockArchetype = yield* _(createArchetype({
        type: 'block',
        pos: { x: 0, y: 5, z: 0 },
        blockType: 'stone',
      }))
      const blockId = yield* _(world.addArchetype(blockArchetype))
      
      // Add block to spatial grid
      const blockCollider = yield* _(world.getComponentUnsafe(blockId, 'collider'))
      const blockPosition = yield* _(world.getComponentUnsafe(blockId, 'position'))
      const blockAABB = createAABB(blockPosition, blockCollider)
      yield* _(spatialGrid.add(blockId, blockAABB))
      
      // Run collision system
      yield* _(collisionSystem)
      
      // Check that player is grounded after collision
      const playerComponent = yield* _(world.getComponentUnsafe(playerId, 'player'))
      assert.isTrue(playerComponent.isGrounded, 'Player should be grounded after collision')
      
      // Check that vertical velocity is zero
      const velocity = yield* _(world.getComponentUnsafe(playerId, 'velocity'))
      assert.equal(velocity.dy, 0, 'Vertical velocity should be zero after collision')
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect('should handle multiple collisions', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      const spatialGrid = yield* _(SpatialGrid)
      
      // Create a player surrounded by blocks
      const playerArchetype = yield* _(createArchetype({
        type: 'player',
        pos: { x: 10, y: 10, z: 10 },
      }))
      const playerId = yield* _(world.addArchetype(playerArchetype))
      
      // Create blocks around the player
      const blockPositions = [
        { x: 9, y: 10, z: 10 },  // Left
        { x: 11, y: 10, z: 10 }, // Right
        { x: 10, y: 10, z: 9 },  // Front
        { x: 10, y: 10, z: 11 }, // Back
      ]
      
      for (const pos of blockPositions) {
        const blockArchetype = yield* _(createArchetype({
          type: 'block',
          pos,
          blockType: 'stone',
        }))
        const blockId = yield* _(world.addArchetype(blockArchetype))
        
        const blockCollider = yield* _(world.getComponentUnsafe(blockId, 'collider'))
        const blockPosition = yield* _(world.getComponentUnsafe(blockId, 'position'))
        const blockAABB = createAABB(blockPosition, blockCollider)
        yield* _(spatialGrid.add(blockId, blockAABB))
      }
      
      // Set player velocity in multiple directions
      yield* _(world.updateComponent(playerId, 'velocity', new Velocity({
        dx: toFloat(2),
        dy: toFloat(0),
        dz: toFloat(2),
      })))
      
      // Run collision system
      yield* _(collisionSystem)
      
      // Check that velocities are zeroed out
      const velocity = yield* _(world.getComponentUnsafe(playerId, 'velocity'))
      assert.equal(velocity.dx, 0, 'X velocity should be zero after collision')
      assert.equal(velocity.dz, 0, 'Z velocity should be zero after collision')
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect('should handle no collisions', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      
      // Create a player in empty space
      const playerArchetype = yield* _(createArchetype({
        type: 'player',
        pos: { x: 0, y: 50, z: 0 },
      }))
      const playerId = yield* _(world.addArchetype(playerArchetype))
      
      const initialVelocity = new Velocity({
        dx: toFloat(5),
        dy: toFloat(-3),
        dz: toFloat(2),
      })
      yield* _(world.updateComponent(playerId, 'velocity', initialVelocity))
      
      // Run collision system
      yield* _(collisionSystem)
      
      // Velocity should remain unchanged
      const velocity = yield* _(world.getComponentUnsafe(playerId, 'velocity'))
      assert.equal(velocity.dx, initialVelocity.dx)
      assert.equal(velocity.dy, initialVelocity.dy)
      assert.equal(velocity.dz, initialVelocity.dz)
      
      // Player should not be grounded
      const player = yield* _(world.getComponentUnsafe(playerId, 'player'))
      assert.isFalse(player.isGrounded)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect('should handle axis-specific collisions', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      const spatialGrid = yield* _(SpatialGrid)
      
      // Create a player moving diagonally
      const playerArchetype = yield* _(createArchetype({
        type: 'player',
        pos: { x: 5, y: 10, z: 5 },
      }))
      const playerId = yield* _(world.addArchetype(playerArchetype))
      
      // Set diagonal velocity
      yield* _(world.updateComponent(playerId, 'velocity', new Velocity({
        dx: toFloat(3),
        dy: toFloat(-2),
        dz: toFloat(0),
      })))
      
      // Create a wall to the right
      const wallArchetype = yield* _(createArchetype({
        type: 'block',
        pos: { x: 7, y: 10, z: 5 },
        blockType: 'stone',
      }))
      const wallId = yield* _(world.addArchetype(wallArchetype))
      
      const wallCollider = yield* _(world.getComponentUnsafe(wallId, 'collider'))
      const wallPosition = yield* _(world.getComponentUnsafe(wallId, 'position'))
      const wallAABB = createAABB(wallPosition, wallCollider)
      yield* _(spatialGrid.add(wallId, wallAABB))
      
      // Run collision system
      yield* _(collisionSystem)
      
      // Only X velocity should be affected
      const velocity = yield* _(world.getComponentUnsafe(playerId, 'velocity'))
      assert.equal(velocity.dx, 0, 'X velocity should be zero after hitting wall')
      assert.notEqual(velocity.dy, 0, 'Y velocity should be unchanged')
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect('should handle player with custom collider size', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      const spatialGrid = yield* _(SpatialGrid)
      
      // Create a player
      const playerArchetype = yield* _(createArchetype({
        type: 'player',
        pos: { x: 0, y: 10, z: 0 },
      }))
      const playerId = yield* _(world.addArchetype(playerArchetype))
      
      // Update collider to be larger
      yield* _(world.updateComponent(playerId, 'collider', new Collider({
        width: toFloat(2), // Wider than default
        height: toFloat(3), // Taller than default
        depth: toFloat(2),
      })))
      
      // Create a block that would not collide with default size
      const blockArchetype = yield* _(createArchetype({
        type: 'block',
        pos: { x: 1.5, y: 10, z: 0 },
        blockType: 'stone',
      }))
      const blockId = yield* _(world.addArchetype(blockArchetype))
      
      const blockCollider = yield* _(world.getComponentUnsafe(blockId, 'collider'))
      const blockPosition = yield* _(world.getComponentUnsafe(blockId, 'position'))
      const blockAABB = createAABB(blockPosition, blockCollider)
      yield* _(spatialGrid.add(blockId, blockAABB))
      
      // Set velocity toward block
      yield* _(world.updateComponent(playerId, 'velocity', new Velocity({
        dx: toFloat(2),
        dy: toFloat(0),
        dz: toFloat(0),
      })))
      
      // Run collision system
      yield* _(collisionSystem)
      
      // Should collide due to larger collider
      const velocity = yield* _(world.getComponentUnsafe(playerId, 'velocity'))
      assert.equal(velocity.dx, 0, 'Should collide with larger collider')
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect('should handle no players', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      const spatialGrid = yield* _(SpatialGrid)
      
      // Create only blocks, no players
      const blockArchetype = yield* _(createArchetype({
        type: 'block',
        pos: { x: 0, y: 0, z: 0 },
        blockType: 'stone',
      }))
      const blockId = yield* _(world.addArchetype(blockArchetype))
      
      const blockCollider = yield* _(world.getComponentUnsafe(blockId, 'collider'))
      const blockPosition = yield* _(world.getComponentUnsafe(blockId, 'position'))
      const blockAABB = createAABB(blockPosition, blockCollider)
      yield* _(spatialGrid.add(blockId, blockAABB))
      
      // Should handle gracefully with no players
      yield* _(collisionSystem)
      assert.isOk(true)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect('should resolve falling collision correctly', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      const spatialGrid = yield* _(SpatialGrid)
      
      // Create a player falling onto a platform
      const playerArchetype = yield* _(createArchetype({
        type: 'player',
        pos: { x: 0, y: 5.5, z: 0 }, // Just above platform
      }))
      const playerId = yield* _(world.addArchetype(playerArchetype))
      
      // Player is falling
      yield* _(world.updateComponent(playerId, 'velocity', new Velocity({
        dx: toFloat(0),
        dy: toFloat(-10), // Fast fall
        dz: toFloat(0),
      })))
      
      yield* _(world.updateComponent(playerId, 'player', new Player({
        isGrounded: false,
      })))
      
      // Create platform below
      const platformArchetype = yield* _(createArchetype({
        type: 'block',
        pos: { x: 0, y: 4, z: 0 },
        blockType: 'stone',
      }))
      const platformId = yield* _(world.addArchetype(platformArchetype))
      
      const platformCollider = yield* _(world.getComponentUnsafe(platformId, 'collider'))
      const platformPosition = yield* _(world.getComponentUnsafe(platformId, 'position'))
      const platformAABB = createAABB(platformPosition, platformCollider)
      yield* _(spatialGrid.add(platformId, platformAABB))
      
      // Run collision system
      yield* _(collisionSystem)
      
      // Player should be on top of platform and grounded
      const player = yield* _(world.getComponentUnsafe(playerId, 'player'))
      assert.isTrue(player.isGrounded, 'Player should be grounded after landing')
      
      const velocity = yield* _(world.getComponentUnsafe(playerId, 'velocity'))
      assert.equal(velocity.dy, 0, 'Y velocity should be zero after landing')
      
      const position = yield* _(world.getComponentUnsafe(playerId, 'position'))
      // Player should be positioned on top of the platform
      assert.isAbove(position.y, platformPosition.y, 'Player should be above platform')
    }).pipe(Effect.provide(TestLayer))
  )
})