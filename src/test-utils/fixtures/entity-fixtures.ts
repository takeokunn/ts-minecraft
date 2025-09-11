import { EntityId, toEntityId } from '@/core/entities/entity'
import { BlockType } from '@/core/values/block-type'
import { Archetype } from '@/domain/archetypes'

/**
 * Entity Fixtures - Predefined test entities and archetypes
 * 
 * Features:
 * - Common entity configurations
 * - Edge case entities
 * - Performance test entities
 * - Realistic entity compositions
 */

/**
 * Player entity fixtures
 */
export const PlayerFixtures = {
  /**
   * Default player at spawn
   */
  default: (): Archetype => ({
    components: {
      position: { x: 0, y: 64, z: 0 },
      velocity: { dx: 0, dy: 0, dz: 0 },
      player: { isGrounded: true },
      inputState: {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: false,
        destroy: false,
        isLocked: false
      },
      cameraState: { pitch: 0, yaw: 0 },
      hotbar: {
        slots: Array(9).fill(BlockType.AIR),
        selectedIndex: 0
      },
      target: { _tag: 'none' as const },
      gravity: { value: -32 },
      collider: { width: 0.6, height: 1.8, depth: 0.6 }
    }
  }),

  /**
   * Player in mid-air (falling)
   */
  falling: (): Archetype => ({
    components: {
      position: { x: 0, y: 100, z: 0 },
      velocity: { dx: 0, dy: -15, dz: 0 },
      player: { isGrounded: false },
      inputState: {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: false,
        destroy: false,
        isLocked: false
      },
      cameraState: { pitch: -0.3, yaw: 0 },
      hotbar: {
        slots: Array(9).fill(BlockType.AIR),
        selectedIndex: 0
      },
      target: { _tag: 'none' as const },
      gravity: { value: -32 },
      collider: { width: 0.6, height: 1.8, depth: 0.6 }
    }
  }),

  /**
   * Player running forward
   */
  running: (): Archetype => ({
    components: {
      position: { x: 0, y: 64, z: 0 },
      velocity: { dx: 0, dy: 0, dz: 8 },
      player: { isGrounded: true },
      inputState: {
        forward: true,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: true,
        place: false,
        destroy: false,
        isLocked: false
      },
      cameraState: { pitch: 0, yaw: 0 },
      hotbar: {
        slots: Array(9).fill(BlockType.AIR),
        selectedIndex: 0
      },
      target: { _tag: 'none' as const },
      gravity: { value: -32 },
      collider: { width: 0.6, height: 1.8, depth: 0.6 }
    }
  }),

  /**
   * Player with full inventory
   */
  withInventory: (): Archetype => ({
    components: {
      position: { x: 0, y: 64, z: 0 },
      velocity: { dx: 0, dy: 0, dz: 0 },
      player: { isGrounded: true },
      inputState: {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: false,
        destroy: false,
        isLocked: false
      },
      cameraState: { pitch: 0, yaw: 0 },
      hotbar: {
        slots: [
          BlockType.STONE,
          BlockType.DIRT,
          BlockType.WOOD,
          BlockType.GLASS,
          BlockType.BRICK,
          BlockType.SAND,
          BlockType.WATER,
          BlockType.LAVA,
          BlockType.GRASS
        ],
        selectedIndex: 2
      },
      target: { _tag: 'none' as const },
      gravity: { value: -32 },
      collider: { width: 0.6, height: 1.8, depth: 0.6 }
    }
  }),

  /**
   * Player looking at block
   */
  lookingAtBlock: (): Archetype => ({
    components: {
      position: { x: 0, y: 64, z: 0 },
      velocity: { dx: 0, dy: 0, dz: 0 },
      player: { isGrounded: true },
      inputState: {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: false,
        destroy: false,
        isLocked: false
      },
      cameraState: { pitch: -0.5, yaw: 0 },
      hotbar: {
        slots: Array(9).fill(BlockType.AIR),
        selectedIndex: 0
      },
      target: { 
        _tag: 'block' as const,
        position: { x: 0, y: 63, z: 0 },
        normal: { x: 0, y: 1, z: 0 }
      },
      gravity: { value: -32 },
      collider: { width: 0.6, height: 1.8, depth: 0.6 }
    }
  })
}

/**
 * Block entity fixtures
 */
export const BlockFixtures = {
  /**
   * Basic stone block
   */
  stone: (position: { x: number; y: number; z: number } = { x: 0, y: 63, z: 0 }): Archetype => ({
    components: {
      position,
      renderable: {
        geometry: 'cube',
        blockType: BlockType.STONE
      },
      collider: { width: 1, height: 1, depth: 1 },
      terrainBlock: {},
      targetBlock: {}
    }
  }),

  /**
   * Grass block
   */
  grass: (position: { x: number; y: number; z: number } = { x: 0, y: 63, z: 0 }): Archetype => ({
    components: {
      position,
      renderable: {
        geometry: 'cube',
        blockType: BlockType.GRASS
      },
      collider: { width: 1, height: 1, depth: 1 },
      terrainBlock: {},
      targetBlock: {}
    }
  }),

  /**
   * Water block (fluid)
   */
  water: (position: { x: number; y: number; z: number } = { x: 0, y: 63, z: 0 }): Archetype => ({
    components: {
      position,
      renderable: {
        geometry: 'cube',
        blockType: BlockType.WATER
      },
      // Note: Water doesn't have solid collision
      terrainBlock: {}
    }
  }),

  /**
   * Floating block (for physics testing)
   */
  floating: (position: { x: number; y: number; z: number } = { x: 0, y: 80, z: 0 }): Archetype => ({
    components: {
      position,
      velocity: { dx: 0, dy: -5, dz: 0 },
      renderable: {
        geometry: 'cube',
        blockType: BlockType.SAND
      },
      collider: { width: 1, height: 1, depth: 1 },
      gravity: { value: -16 }, // Lighter gravity for blocks
      terrainBlock: {},
      targetBlock: {}
    }
  })
}

/**
 * Camera entity fixtures
 */
export const CameraFixtures = {
  /**
   * Standard third-person camera
   */
  thirdPerson: (targetPosition: { x: number; y: number; z: number }): Archetype => ({
    components: {
      position: { 
        x: targetPosition.x - 5, 
        y: targetPosition.y + 3, 
        z: targetPosition.z - 5 
      },
      camera: {},
      cameraState: { pitch: -0.3, yaw: Math.PI / 4 }
    }
  }),

  /**
   * First-person camera
   */
  firstPerson: (position: { x: number; y: number; z: number }): Archetype => ({
    components: {
      position: { x: position.x, y: position.y + 1.6, z: position.z },
      camera: {},
      cameraState: { pitch: 0, yaw: 0 }
    }
  }),

  /**
   * Cinematic camera with smooth movement
   */
  cinematic: (position: { x: number; y: number; z: number }): Archetype => ({
    components: {
      position,
      velocity: { dx: 1, dy: 0.2, dz: 0.5 },
      camera: {},
      cameraState: { pitch: -0.1, yaw: 0.1 }
    }
  })
}

/**
 * Chunk fixtures
 */
export const ChunkFixtures = {
  /**
   * Empty chunk
   */
  empty: (chunkX: number = 0, chunkZ: number = 0): Archetype => ({
    components: {
      chunk: {
        x: chunkX,
        z: chunkZ,
        blocks: new Array(4096).fill(BlockType.AIR), // 16x16x16
        generated: true,
        modified: false
      }
    }
  }),

  /**
   * Flat terrain chunk
   */
  flatTerrain: (chunkX: number = 0, chunkZ: number = 0, height: number = 63): Archetype => {
    const blocks = new Array(4096).fill(BlockType.AIR)
    
    // Fill bottom layers with stone
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        for (let y = 0; y <= height; y++) {
          const index = y * 256 + z * 16 + x
          if (y === height) {
            blocks[index] = BlockType.GRASS
          } else if (y >= height - 3) {
            blocks[index] = BlockType.DIRT
          } else {
            blocks[index] = BlockType.STONE
          }
        }
      }
    }

    return {
      components: {
        chunk: {
          x: chunkX,
          z: chunkZ,
          blocks,
          generated: true,
          modified: false
        }
      }
    }
  },

  /**
   * Mountainous terrain chunk
   */
  mountainous: (chunkX: number = 0, chunkZ: number = 0): Archetype => {
    const blocks = new Array(4096).fill(BlockType.AIR)
    
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        // Simple height map using sine waves
        const height = Math.floor(
          64 + 
          20 * Math.sin((chunkX * 16 + x) * 0.1) * Math.cos((chunkZ * 16 + z) * 0.1) +
          10 * Math.sin((chunkX * 16 + x) * 0.05) * Math.cos((chunkZ * 16 + z) * 0.05)
        )
        
        for (let y = 0; y <= Math.min(height, 255); y++) {
          const index = y * 256 + z * 16 + x
          if (y === height) {
            blocks[index] = height > 80 ? BlockType.STONE : BlockType.GRASS
          } else if (y >= height - 3) {
            blocks[index] = BlockType.DIRT
          } else {
            blocks[index] = BlockType.STONE
          }
        }
      }
    }

    return {
      components: {
        chunk: {
          x: chunkX,
          z: chunkZ,
          blocks,
          generated: true,
          modified: false
        }
      }
    }
  }
}

/**
 * Complex scenario fixtures
 */
export const ScenarioFixtures = {
  /**
   * Player mining scenario
   */
  mining: () => ({
    player: PlayerFixtures.withInventory(),
    targetBlock: BlockFixtures.stone({ x: 2, y: 63, z: 0 }),
    groundBlocks: [
      BlockFixtures.grass({ x: 1, y: 63, z: 0 }),
      BlockFixtures.grass({ x: 2, y: 63, z: 0 }),
      BlockFixtures.grass({ x: 3, y: 63, z: 0 }),
      BlockFixtures.stone({ x: 1, y: 62, z: 0 }),
      BlockFixtures.stone({ x: 2, y: 62, z: 0 }),
      BlockFixtures.stone({ x: 3, y: 62, z: 0 })
    ]
  }),

  /**
   * Player building scenario
   */
  building: () => ({
    player: PlayerFixtures.withInventory(),
    foundation: [
      BlockFixtures.stone({ x: 0, y: 63, z: 0 }),
      BlockFixtures.stone({ x: 1, y: 63, z: 0 }),
      BlockFixtures.stone({ x: 0, y: 63, z: 1 }),
      BlockFixtures.stone({ x: 1, y: 63, z: 1 })
    ],
    workingSpace: [] as Archetype[] // Empty space for building
  }),

  /**
   * Water physics scenario
   */
  waterPhysics: () => ({
    player: PlayerFixtures.falling(),
    water: Array.from({ length: 25 }, (_, i) => 
      BlockFixtures.water({ 
        x: (i % 5) - 2, 
        y: 60, 
        z: Math.floor(i / 5) - 2 
      })
    ),
    ground: Array.from({ length: 25 }, (_, i) => 
      BlockFixtures.stone({ 
        x: (i % 5) - 2, 
        y: 59, 
        z: Math.floor(i / 5) - 2 
      })
    )
  }),

  /**
   * Cave exploration scenario
   */
  caveExploration: () => {
    const entities: { [key: string]: Archetype[] } = {
      player: [PlayerFixtures.default()],
      cave: [],
      surface: []
    }

    // Create cave system
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        // Surface
        entities.surface.push(BlockFixtures.grass({ x, y: 64, z }))
        
        // Cave walls (skip center for open space)
        if (Math.abs(x) > 2 || Math.abs(z) > 2) {
          for (let y = 50; y < 64; y++) {
            entities.cave.push(BlockFixtures.stone({ x, y, z }))
          }
        }
      }
    }

    return entities
  }
}

/**
 * Edge case fixtures
 */
export const EdgeCaseFixtures = {
  /**
   * Entity at world boundaries
   */
  atWorldBoundary: (): Archetype => ({
    components: {
      position: { x: 29999999, y: 255, z: 29999999 },
      velocity: { dx: 1, dy: 0, dz: 1 }, // Moving further out of bounds
      player: { isGrounded: false },
      collider: { width: 0.6, height: 1.8, depth: 0.6 }
    }
  }),

  /**
   * Entity with extreme velocity
   */
  extremeVelocity: (): Archetype => ({
    components: {
      position: { x: 0, y: 100, z: 0 },
      velocity: { dx: 1000, dy: -1000, dz: 500 },
      collider: { width: 1, height: 1, depth: 1 }
    }
  }),

  /**
   * Invisible block (no renderable component)
   */
  invisibleBlock: (): Archetype => ({
    components: {
      position: { x: 0, y: 63, z: 0 },
      collider: { width: 1, height: 1, depth: 1 },
      terrainBlock: {}
    }
  }),

  /**
   * Oversized entity
   */
  oversized: (): Archetype => ({
    components: {
      position: { x: 0, y: 64, z: 0 },
      collider: { width: 100, height: 100, depth: 100 },
      renderable: {
        geometry: 'cube',
        blockType: BlockType.STONE
      }
    }
  })
}

/**
 * Performance testing fixtures
 */
export const PerformanceFixtures = {
  /**
   * Generate many similar entities for stress testing
   */
  manyEntities: (count: number, type: 'player' | 'block' = 'block'): Archetype[] => {
    const entities: Archetype[] = []
    
    for (let i = 0; i < count; i++) {
      const x = (i % 100) - 50
      const z = Math.floor(i / 100) - 50
      
      if (type === 'player') {
        entities.push({
          components: {
            position: { x, y: 64, z },
            velocity: { dx: 0, dy: 0, dz: 0 },
            player: { isGrounded: true },
            collider: { width: 0.6, height: 1.8, depth: 0.6 },
            inputState: {
              forward: false, backward: false, left: false, right: false,
              jump: false, sprint: false, place: false, destroy: false, isLocked: false
            }
          }
        })
      } else {
        entities.push({
          components: {
            position: { x, y: 63, z },
            renderable: {
              geometry: 'cube',
              blockType: BlockType.STONE
            },
            collider: { width: 1, height: 1, depth: 1 },
            terrainBlock: {}
          }
        })
      }
    }
    
    return entities
  },

  /**
   * Complex entity with many components
   */
  complexEntity: (): Archetype => ({
    components: {
      position: { x: 0, y: 64, z: 0 },
      velocity: { dx: 5, dy: 0, dz: 3 },
      player: { isGrounded: true },
      inputState: {
        forward: true, backward: false, left: true, right: false,
        jump: false, sprint: true, place: false, destroy: false, isLocked: false
      },
      cameraState: { pitch: -0.2, yaw: 0.5 },
      hotbar: {
        slots: [BlockType.STONE, BlockType.DIRT, BlockType.WOOD, BlockType.GLASS, 
               BlockType.BRICK, BlockType.SAND, BlockType.WATER, BlockType.LAVA, BlockType.GRASS],
        selectedIndex: 4
      },
      target: { 
        _tag: 'block' as const,
        position: { x: 5, y: 64, z: 3 },
        normal: { x: 0, y: 1, z: 0 }
      },
      gravity: { value: -32 },
      collider: { width: 0.6, height: 1.8, depth: 0.6 }
    }
  })
}

/**
 * Fixture utilities
 */
export const FixtureUtils = {
  /**
   * Create entity with only specified components
   */
  withComponents: (components: Record<string, any>): Archetype => ({
    components
  }),

  /**
   * Modify existing fixture
   */
  modify: <T extends Archetype>(fixture: T, modifications: Partial<T['components']>): T => ({
    ...fixture,
    components: {
      ...fixture.components,
      ...modifications
    }
  }),

  /**
   * Create entity at specific position
   */
  atPosition: (fixture: Archetype, position: { x: number; y: number; z: number }): Archetype =>
    FixtureUtils.modify(fixture, { position }),

  /**
   * Create multiple entities in a grid pattern
   */
  inGrid: (
    fixture: Archetype, 
    width: number, 
    height: number, 
    spacing: number = 1,
    origin: { x: number; y: number; z: number } = { x: 0, y: 63, z: 0 }
  ): Archetype[] => {
    const entities: Archetype[] = []
    
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < height; z++) {
        entities.push(
          FixtureUtils.atPosition(fixture, {
            x: origin.x + x * spacing,
            y: origin.y,
            z: origin.z + z * spacing
          })
        )
      }
    }
    
    return entities
  },

  /**
   * Validate fixture has required components
   */
  validate: (fixture: Archetype, requiredComponents: string[]): boolean => {
    return requiredComponents.every(component => 
      component in fixture.components
    )
  }
}