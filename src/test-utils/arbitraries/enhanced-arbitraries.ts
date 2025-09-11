import * as S from "/schema/Schema"
import * as Arbitrary from 'effect/Arbitrary'
import * as fc from 'effect/FastCheck'
import { Effect, pipe } from 'effect'

// Re-export all existing arbitraries
export * from './arbitraries'

/**
 * Enhanced Arbitraries for Property-Based Testing
 * 
 * Features:
 * - Complex domain-specific generators
 * - Constraint-based generation
 * - Realistic test data patterns
 * - Performance-optimized generators
 * - Composition utilities
 */

/**
 * Coordinate system arbitraries
 */
export const Coordinates = {
  /**
   * Valid world coordinates (within reasonable bounds)
   */
  worldPosition: fc.record({
    x: fc.integer({ min: -1000, max: 1000 }),
    y: fc.integer({ min: 0, max: 256 }),
    z: fc.integer({ min: -1000, max: 1000 })
  }),

  /**
   * Chunk coordinates
   */
  chunkPosition: fc.record({
    x: fc.integer({ min: -64, max: 64 }),
    z: fc.integer({ min: -64, max: 64 })
  }),

  /**
   * Relative coordinates within a chunk
   */
  relativePosition: fc.record({
    x: fc.integer({ min: 0, max: 15 }),
    y: fc.integer({ min: 0, max: 255 }),
    z: fc.integer({ min: 0, max: 15 })
  }),

  /**
   * Player spawn coordinates (on solid ground)
   */
  spawnPosition: fc.record({
    x: fc.float({ min: -100, max: 100 }),
    y: fc.integer({ min: 64, max: 128 }),
    z: fc.float({ min: -100, max: 100 })
  })
}

/**
 * Physics and movement arbitraries
 */
export const Physics = {
  /**
   * Realistic velocity values
   */
  velocity: fc.record({
    dx: fc.float({ min: -20, max: 20 }),
    dy: fc.float({ min: -50, max: 20 }),
    dz: fc.float({ min: -20, max: 20 })
  }),

  /**
   * Camera rotation (pitch constrained to prevent gimbal lock)
   */
  cameraRotation: fc.record({
    pitch: fc.float({ min: -Math.PI / 2 + 0.1, max: Math.PI / 2 - 0.1 }),
    yaw: fc.float({ min: -Math.PI, max: Math.PI })
  }),

  /**
   * Collision box dimensions
   */
  collider: fc.record({
    width: fc.float({ min: 0.1, max: 5.0 }),
    height: fc.float({ min: 0.1, max: 5.0 }),
    depth: fc.float({ min: 0.1, max: 5.0 })
  }),

  /**
   * Gravity values (reasonable range)
   */
  gravity: fc.float({ min: -50, max: -5 })
}

/**
 * Game state arbitraries
 */
export const GameState = {
  /**
   * Input state with realistic key combinations
   */
  inputState: fc.record({
    forward: fc.boolean(),
    backward: fc.boolean(),
    left: fc.boolean(),
    right: fc.boolean(),
    jump: fc.boolean(),
    sprint: fc.boolean(),
    place: fc.boolean(),
    destroy: fc.boolean(),
    isLocked: fc.boolean()
  }).filter(input => 
    // Prevent impossible combinations
    !(input.forward && input.backward) &&
    !(input.left && input.right)
  ),

  /**
   * Hotbar with valid items
   */
  hotbar: fc.record({
    slots: fc.array(fc.constantFrom('AIR', 'STONE', 'GRASS', 'DIRT', 'WOOD'), { 
      minLength: 9, 
      maxLength: 9 
    }),
    selectedIndex: fc.integer({ min: 0, max: 8 })
  }),

  /**
   * Player state combinations
   */
  playerState: fc.record({
    isGrounded: fc.boolean(),
    isMoving: fc.boolean(),
    isSprinting: fc.boolean(),
    health: fc.float({ min: 0, max: 20 }),
    hunger: fc.float({ min: 0, max: 20 })
  })
}

/**
 * World generation arbitraries
 */
export const WorldGen = {
  /**
   * Terrain height map
   */
  heightMap: fc.array(
    fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 16, maxLength: 16 }),
    { minLength: 16, maxLength: 16 }
  ),

  /**
   * Block distribution patterns
   */
  blockPattern: fc.record({
    primary: fc.constantFrom('STONE', 'DIRT', 'GRASS'),
    secondary: fc.constantFrom('STONE', 'DIRT', 'SAND'),
    density: fc.float({ min: 0.1, max: 0.9 })
  }),

  /**
   * Chunk data structure
   */
  chunkData: fc.record({
    position: Coordinates.chunkPosition,
    blocks: fc.array(
      fc.constantFrom('AIR', 'STONE', 'GRASS', 'DIRT', 'WATER'),
      { minLength: 4096, maxLength: 4096 } // 16x16x16
    ),
    metadata: fc.record({
      generated: fc.boolean(),
      populated: fc.boolean(),
      lightLevel: fc.integer({ min: 0, max: 15 })
    })
  })
}

/**
 * Complex composite arbitraries
 */
export const Composite = {
  /**
   * Complete game world scenario
   */
  worldScenario: fc.record({
    world: fc.record({
      seed: fc.integer({ min: 0, max: 2147483647 }),
      spawnPoint: Coordinates.spawnPosition,
      chunks: fc.array(WorldGen.chunkData, { minLength: 1, maxLength: 9 })
    }),
    players: fc.array(
      fc.record({
        id: fc.integer({ min: 1, max: 1000 }),
        position: Coordinates.worldPosition,
        state: GameState.playerState,
        input: GameState.inputState,
        inventory: GameState.hotbar
      }),
      { minLength: 1, maxLength: 4 }
    ),
    time: fc.record({
      dayTime: fc.integer({ min: 0, max: 24000 }),
      weatherClear: fc.boolean()
    })
  }),

  /**
   * Physics simulation scenario
   */
  physicsScenario: fc.record({
    entities: fc.array(
      fc.record({
        id: fc.integer({ min: 1, max: 1000 }),
        position: Coordinates.worldPosition,
        velocity: Physics.velocity,
        collider: Physics.collider,
        mass: fc.float({ min: 0.1, max: 100.0 })
      }),
      { minLength: 1, maxLength: 10 }
    ),
    gravity: Physics.gravity,
    friction: fc.float({ min: 0.0, max: 1.0 }),
    deltaTime: fc.float({ min: 0.001, max: 0.1 })
  })
}

/**
 * Constraint-based generators
 */
export const Constrained = {
  /**
   * Generate positions within a bounding box
   */
  positionInBounds: (bounds: {
    minX: number, maxX: number,
    minY: number, maxY: number,
    minZ: number, maxZ: number
  }) => fc.record({
    x: fc.float({ min: bounds.minX, max: bounds.maxX }),
    y: fc.float({ min: bounds.minY, max: bounds.maxY }),
    z: fc.float({ min: bounds.minZ, max: bounds.maxZ })
  }),

  /**
   * Generate entities that don't overlap
   */
  nonOverlappingEntities: (count: number, bounds: any) => {
    const positions: any[] = []
    return fc.array(
      fc.record({
        position: Constrained.positionInBounds(bounds).filter(pos => {
          // Simple non-overlap check
          const overlaps = positions.some(existingPos =>
            Math.abs(pos.x - existingPos.x) < 2 &&
            Math.abs(pos.z - existingPos.z) < 2
          )
          if (!overlaps) {
            positions.push(pos)
            return true
          }
          return false
        }),
        collider: Physics.collider
      }),
      { minLength: count, maxLength: count }
    )
  },

  /**
   * Generate valid player movement sequences
   */
  movementSequence: (duration: number) => 
    fc.array(
      fc.record({
        input: GameState.inputState,
        deltaTime: fc.float({ min: 0.01, max: 0.05 }),
        timestamp: fc.float({ min: 0, max: duration })
      }),
      { minLength: Math.floor(duration / 0.05), maxLength: Math.ceil(duration / 0.01) }
    ).map(sequence => 
      sequence.sort((a, b) => a.timestamp - b.timestamp)
    )
}

/**
 * Performance-focused arbitraries
 */
export const Performance = {
  /**
   * Large world state for stress testing
   */
  largeWorld: fc.record({
    entities: fc.array(
      fc.record({
        id: fc.integer({ min: 1, max: 10000 }),
        components: fc.constantFrom('minimal', 'standard', 'complex')
      }),
      { minLength: 1000, maxLength: 10000 }
    ),
    chunks: fc.array(WorldGen.chunkData, { minLength: 100, maxLength: 1000 })
  }),

  /**
   * High-frequency input events
   */
  inputStream: fc.array(
    fc.record({
      type: fc.constantFrom('keydown', 'keyup', 'mousemove', 'mousedown', 'mouseup'),
      timestamp: fc.float({ min: 0, max: 10000 }),
      data: fc.oneof(
        GameState.inputState,
        fc.record({ dx: fc.integer({ min: -100, max: 100 }), dy: fc.integer({ min: -100, max: 100 }) })
      )
    }),
    { minLength: 100, maxLength: 1000 }
  ).map(events => events.sort((a, b) => a.timestamp - b.timestamp))
}

/**
 * Utility functions for arbitrary composition
 */
export const ArbitraryUtils = {
  /**
   * Combine multiple arbitraries with weights
   */
  weighted: <T>(...weightedArbs: Array<[number, fc.Arbitrary<T>]>) => {
    const totalWeight = weightedArbs.reduce((sum, [weight]) => sum + weight, 0)
    return fc.integer({ min: 1, max: totalWeight }).chain(n => {
      let currentWeight = 0
      for (const [weight, arb] of weightedArbs) {
        currentWeight += weight
        if (n <= currentWeight) return arb
      }
      return weightedArbs[weightedArbs.length - 1][1]
    })
  },

  /**
   * Create dependent arbitraries where B depends on A
   */
  dependent: <A, B>(
    arbA: fc.Arbitrary<A>,
    createArbB: (a: A) => fc.Arbitrary<B>
  ): fc.Arbitrary<[A, B]> => {
    return arbA.chain(a => createArbB(a).map(b => [a, b] as [A, B]))
  },

  /**
   * Shrink arbitrary to specific constraints
   */
  constrain: <T>(
    arb: fc.Arbitrary<T>,
    predicate: (value: T) => boolean,
    maxTries: number = 100
  ): fc.Arbitrary<T> => {
    return arb.filter(predicate)
  },

  /**
   * Generate realistic time sequences
   */
  timeSequence: (start: number, duration: number, eventCount: number) =>
    fc.array(
      fc.float({ min: start, max: start + duration }),
      { minLength: eventCount, maxLength: eventCount }
    ).map(times => times.sort((a, b) => a - b))
}

/**
 * Domain-specific test scenarios
 */
export const Scenarios = {
  /**
   * Player interaction scenarios
   */
  playerInteraction: fc.record({
    player: fc.record({
      position: Coordinates.worldPosition,
      looking: Physics.cameraRotation,
      input: GameState.inputState
    }),
    target: fc.oneof(
      fc.record({ type: fc.constant('block'), position: Coordinates.worldPosition }),
      fc.record({ type: fc.constant('entity'), id: fc.integer({ min: 1, max: 1000 }) }),
      fc.record({ type: fc.constant('none') })
    ),
    action: fc.constantFrom('place', 'destroy', 'interact', 'none')
  }),

  /**
   * Chunk loading scenarios
   */
  chunkLoading: fc.record({
    playerPosition: Coordinates.worldPosition,
    renderDistance: fc.integer({ min: 2, max: 32 }),
    loadedChunks: fc.array(Coordinates.chunkPosition, { minLength: 4, maxLength: 100 }),
    requestedChunks: fc.array(Coordinates.chunkPosition, { minLength: 0, maxLength: 50 })
  }),

  /**
   * Multiplayer synchronization scenarios
   */
  multiplayerSync: fc.record({
    players: fc.array(
      fc.record({
        id: fc.integer({ min: 1, max: 100 }),
        position: Coordinates.worldPosition,
        actions: fc.array(
          fc.record({
            type: fc.constantFrom('move', 'place', 'destroy', 'chat'),
            timestamp: fc.integer({ min: 0, max: 10000 }),
            data: fc.anything()
          }),
          { minLength: 0, maxLength: 10 }
        )
      }),
      { minLength: 2, maxLength: 10 }
    ),
    networkDelay: fc.integer({ min: 0, max: 500 }),
    packetLoss: fc.float({ min: 0, max: 0.1 })
  })
}