import { EntityId, toEntityId } from '@/core/entities/entity'
import { BlockType } from '@/core/values/block-type'
import { Archetype } from '@/domain/archetypes'
import { WorldState } from '@/domain/world'
import * as HashMap from 'effect/HashMap'

/**
 * World Fixtures - Predefined test world states
 * 
 * Features:
 * - Common test scenarios
 * - Realistic world configurations
 * - Edge case scenarios
 * - Performance test data
 */

/**
 * Basic world fixtures
 */
export const BasicWorlds = {
  /**
   * Empty world with no entities
   */
  empty: (): WorldState => ({
    nextEntityId: 1,
    entities: HashMap.empty(),
    archetypes: HashMap.empty(),
    components: {
      position: HashMap.empty(),
      velocity: HashMap.empty(),
      player: HashMap.empty(),
      inputState: HashMap.empty(),
      cameraState: HashMap.empty(),
      hotbar: HashMap.empty(),
      target: HashMap.empty(),
      gravity: HashMap.empty(),
      collider: HashMap.empty(),
      renderable: HashMap.empty(),
      instancedMeshRenderable: HashMap.empty(),
      terrainBlock: HashMap.empty(),
      chunk: HashMap.empty(),
      camera: HashMap.empty(),
      targetBlock: HashMap.empty(),
      chunkLoaderState: HashMap.empty()
    },
    chunks: HashMap.empty()
  }),

  /**
   * Single player at spawn
   */
  singlePlayer: (): WorldState => {
    const base = BasicWorlds.empty()
    const playerId = toEntityId(1)
    
    return {
      ...base,
      nextEntityId: 2,
      entities: HashMap.set(base.entities, playerId, 'player'),
      components: {
        ...base.components,
        position: HashMap.set(base.components.position, playerId, { x: 0, y: 64, z: 0 }),
        velocity: HashMap.set(base.components.velocity, playerId, { dx: 0, dy: 0, dz: 0 }),
        player: HashMap.set(base.components.player, playerId, { isGrounded: true }),
        inputState: HashMap.set(base.components.inputState, playerId, {
          forward: false,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sprint: false,
          place: false,
          destroy: false,
          isLocked: false
        }),
        cameraState: HashMap.set(base.components.cameraState, playerId, { pitch: 0, yaw: 0 }),
        hotbar: HashMap.set(base.components.hotbar, playerId, {
          slots: Array(9).fill(BlockType.AIR),
          selectedIndex: 0
        }),
        target: HashMap.set(base.components.target, playerId, { _tag: 'none' }),
        gravity: HashMap.set(base.components.gravity, playerId, { value: -32 }),
        collider: HashMap.set(base.components.collider, playerId, { width: 0.6, height: 1.8, depth: 0.6 })
      }
    }
  },

  /**
   * Player with basic terrain
   */
  playerWithTerrain: (): WorldState => {
    const base = BasicWorlds.singlePlayer()
    
    // Add some ground blocks
    const blocks: Array<{ id: EntityId; pos: { x: number; y: number; z: number }; type: BlockType }> = [
      { id: toEntityId(2), pos: { x: 0, y: 63, z: 0 }, type: BlockType.GRASS },
      { id: toEntityId(3), pos: { x: 1, y: 63, z: 0 }, type: BlockType.GRASS },
      { id: toEntityId(4), pos: { x: 0, y: 63, z: 1 }, type: BlockType.GRASS },
      { id: toEntityId(5), pos: { x: 1, y: 63, z: 1 }, type: BlockType.GRASS }
    ]

    let result = { ...base, nextEntityId: 6 }

    blocks.forEach(block => {
      result.entities = HashMap.set(result.entities, block.id, 'block')
      result.components.position = HashMap.set(result.components.position, block.id, block.pos)
      result.components.renderable = HashMap.set(result.components.renderable, block.id, {
        geometry: 'cube',
        blockType: block.type
      })
      result.components.collider = HashMap.set(result.components.collider, block.id, { width: 1, height: 1, depth: 1 })
      result.components.terrainBlock = HashMap.set(result.components.terrainBlock, block.id, {})
      result.components.targetBlock = HashMap.set(result.components.targetBlock, block.id, {})
    })

    return result
  }
}

/**
 * Complex scenario fixtures
 */
export const ScenarioWorlds = {
  /**
   * Multiplayer world with multiple players
   */
  multiplayer: (): WorldState => {
    const base = BasicWorlds.empty()
    
    const players = [
      { id: toEntityId(1), pos: { x: 0, y: 64, z: 0 } },
      { id: toEntityId(2), pos: { x: 10, y: 64, z: 0 } },
      { id: toEntityId(3), pos: { x: 0, y: 64, z: 10 } }
    ]

    let result = { ...base, nextEntityId: 4 }

    players.forEach(player => {
      result.entities = HashMap.set(result.entities, player.id, 'player')
      result.components.position = HashMap.set(result.components.position, player.id, player.pos)
      result.components.velocity = HashMap.set(result.components.velocity, player.id, { dx: 0, dy: 0, dz: 0 })
      result.components.player = HashMap.set(result.components.player, player.id, { isGrounded: true })
      result.components.inputState = HashMap.set(result.components.inputState, player.id, {
        forward: false, backward: false, left: false, right: false,
        jump: false, sprint: false, place: false, destroy: false, isLocked: false
      })
      result.components.cameraState = HashMap.set(result.components.cameraState, player.id, { pitch: 0, yaw: 0 })
      result.components.hotbar = HashMap.set(result.components.hotbar, player.id, {
        slots: Array(9).fill(BlockType.AIR),
        selectedIndex: 0
      })
      result.components.target = HashMap.set(result.components.target, player.id, { _tag: 'none' })
      result.components.gravity = HashMap.set(result.components.gravity, player.id, { value: -32 })
      result.components.collider = HashMap.set(result.components.collider, player.id, { width: 0.6, height: 1.8, depth: 0.6 })
    })

    return result
  },

  /**
   * Underground mining scenario
   */
  undergroundMining: (): WorldState => {
    const base = BasicWorlds.singlePlayer()
    
    // Create a cave system
    const blocks: Array<{ id: EntityId; pos: { x: number; y: number; z: number }; type: BlockType }> = []
    let nextId = 2

    // Ground level
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        blocks.push({
          id: toEntityId(nextId++),
          pos: { x, y: 63, z },
          type: BlockType.GRASS
        })
      }
    }

    // Underground stone
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        for (let y = 50; y < 63; y++) {
          if (!(x === 0 && z === 0 && y > 55)) { // Leave cave space
            blocks.push({
              id: toEntityId(nextId++),
              pos: { x, y, z },
              type: BlockType.STONE
            })
          }
        }
      }
    }

    let result = { ...base, nextEntityId: nextId }

    blocks.forEach(block => {
      result.entities = HashMap.set(result.entities, block.id, 'block')
      result.components.position = HashMap.set(result.components.position, block.id, block.pos)
      result.components.renderable = HashMap.set(result.components.renderable, block.id, {
        geometry: 'cube',
        blockType: block.type
      })
      result.components.collider = HashMap.set(result.components.collider, block.id, { width: 1, height: 1, depth: 1 })
      result.components.terrainBlock = HashMap.set(result.components.terrainBlock, block.id, {})
      result.components.targetBlock = HashMap.set(result.components.targetBlock, block.id, {})
    })

    return result
  },

  /**
   * Building construction scenario
   */
  construction: (): WorldState => {
    const base = BasicWorlds.playerWithTerrain()
    
    // Add construction materials to player's hotbar
    const playerId = toEntityId(1)
    
    return {
      ...base,
      components: {
        ...base.components,
        hotbar: HashMap.set(base.components.hotbar, playerId, {
          slots: [
            BlockType.STONE,
            BlockType.WOOD,
            BlockType.GLASS,
            BlockType.BRICK,
            BlockType.AIR,
            BlockType.AIR,
            BlockType.AIR,
            BlockType.AIR,
            BlockType.AIR
          ],
          selectedIndex: 0
        })
      }
    }
  }
}

/**
 * Edge case fixtures for testing boundary conditions
 */
export const EdgeCaseWorlds = {
  /**
   * World at maximum entity limit
   */
  maxEntities: (): WorldState => {
    const base = BasicWorlds.empty()
    const maxEntities = 1000
    
    let result = { ...base, nextEntityId: maxEntities + 1 }

    for (let i = 1; i <= maxEntities; i++) {
      const entityId = toEntityId(i)
      result.entities = HashMap.set(result.entities, entityId, 'block')
      result.components.position = HashMap.set(result.components.position, entityId, {
        x: i % 32,
        y: 63,
        z: Math.floor(i / 32)
      })
      result.components.renderable = HashMap.set(result.components.renderable, entityId, {
        geometry: 'cube',
        blockType: BlockType.STONE
      })
    }

    return result
  },

  /**
   * Player at world boundaries
   */
  worldBoundaries: (): WorldState => {
    const base = BasicWorlds.singlePlayer()
    const playerId = toEntityId(1)
    
    return {
      ...base,
      components: {
        ...base.components,
        position: HashMap.set(base.components.position, playerId, { x: 29999999, y: 255, z: 29999999 })
      }
    }
  },

  /**
   * Floating player (no ground)
   */
  floatingPlayer: (): WorldState => {
    const base = BasicWorlds.singlePlayer()
    const playerId = toEntityId(1)
    
    return {
      ...base,
      components: {
        ...base.components,
        position: HashMap.set(base.components.position, playerId, { x: 0, y: 128, z: 0 }),
        player: HashMap.set(base.components.player, playerId, { isGrounded: false }),
        velocity: HashMap.set(base.components.velocity, playerId, { dx: 0, dy: -10, dz: 0 })
      }
    }
  }
}

/**
 * Performance test fixtures
 */
export const PerformanceWorlds = {
  /**
   * Dense block world for collision testing
   */
  denseBlocks: (): WorldState => {
    const base = BasicWorlds.empty()
    let nextId = 1
    
    let result = base

    // Create a 50x50x50 cube of blocks
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        for (let z = 0; z < 50; z++) {
          const entityId = toEntityId(nextId++)
          result.entities = HashMap.set(result.entities, entityId, 'block')
          result.components.position = HashMap.set(result.components.position, entityId, { x, y, z })
          result.components.renderable = HashMap.set(result.components.renderable, entityId, {
            geometry: 'cube',
            blockType: x % 2 === 0 ? BlockType.STONE : BlockType.DIRT
          })
          result.components.collider = HashMap.set(result.components.collider, entityId, { width: 1, height: 1, depth: 1 })
        }
      }
    }

    result.nextEntityId = nextId
    return result
  },

  /**
   * Many players for networking tests
   */
  manyPlayers: (): WorldState => {
    const base = BasicWorlds.empty()
    const playerCount = 100
    let nextId = 1
    
    let result = { ...base, nextEntityId: playerCount + 1 }

    for (let i = 0; i < playerCount; i++) {
      const playerId = toEntityId(nextId++)
      const angle = (i / playerCount) * 2 * Math.PI
      const radius = 50
      
      result.entities = HashMap.set(result.entities, playerId, 'player')
      result.components.position = HashMap.set(result.components.position, playerId, {
        x: Math.cos(angle) * radius,
        y: 64,
        z: Math.sin(angle) * radius
      })
      result.components.velocity = HashMap.set(result.components.velocity, playerId, { dx: 0, dy: 0, dz: 0 })
      result.components.player = HashMap.set(result.components.player, playerId, { isGrounded: true })
      result.components.inputState = HashMap.set(result.components.inputState, playerId, {
        forward: Math.random() > 0.5,
        backward: false,
        left: Math.random() > 0.7,
        right: Math.random() > 0.7,
        jump: Math.random() > 0.9,
        sprint: Math.random() > 0.8,
        place: false,
        destroy: false,
        isLocked: false
      })
      result.components.cameraState = HashMap.set(result.components.cameraState, playerId, {
        pitch: (Math.random() - 0.5) * 0.5,
        yaw: Math.random() * 2 * Math.PI
      })
      result.components.collider = HashMap.set(result.components.collider, playerId, { width: 0.6, height: 1.8, depth: 0.6 })
    }

    return result
  }
}

/**
 * Fixture utilities
 */
export const FixtureUtils = {
  /**
   * Create a world with specified number of random entities
   */
  randomWorld: (entityCount: number, seed?: number): WorldState => {
    const base = BasicWorlds.empty()
    const rng = seed ? () => Math.sin(seed++) * 10000 % 1 : Math.random
    
    let result = { ...base, nextEntityId: entityCount + 1 }

    for (let i = 1; i <= entityCount; i++) {
      const entityId = toEntityId(i)
      const isPlayer = rng() > 0.8
      
      result.entities = HashMap.set(result.entities, entityId, isPlayer ? 'player' : 'block')
      result.components.position = HashMap.set(result.components.position, entityId, {
        x: Math.floor(rng() * 200) - 100,
        y: Math.floor(rng() * 100) + 50,
        z: Math.floor(rng() * 200) - 100
      })

      if (isPlayer) {
        result.components.velocity = HashMap.set(result.components.velocity, entityId, { dx: 0, dy: 0, dz: 0 })
        result.components.player = HashMap.set(result.components.player, entityId, { isGrounded: rng() > 0.3 })
        result.components.collider = HashMap.set(result.components.collider, entityId, { width: 0.6, height: 1.8, depth: 0.6 })
      } else {
        result.components.renderable = HashMap.set(result.components.renderable, entityId, {
          geometry: 'cube',
          blockType: rng() > 0.5 ? BlockType.STONE : BlockType.DIRT
        })
        result.components.collider = HashMap.set(result.components.collider, entityId, { width: 1, height: 1, depth: 1 })
      }
    }

    return result
  },

  /**
   * Clone a world state for mutation testing
   */
  clone: (world: WorldState): WorldState => ({
    nextEntityId: world.nextEntityId,
    entities: HashMap.fromIterable(HashMap.entries(world.entities)),
    archetypes: HashMap.fromIterable(HashMap.entries(world.archetypes)),
    components: Object.fromEntries(
      Object.entries(world.components).map(([key, map]) => [
        key,
        HashMap.fromIterable(HashMap.entries(map))
      ])
    ) as any,
    chunks: HashMap.fromIterable(HashMap.entries(world.chunks))
  }),

  /**
   * Validate world state integrity
   */
  validate: (world: WorldState): { valid: boolean; errors: string[] } => {
    const errors: string[] = []

    // Check entity consistency
    for (const [entityId] of HashMap.entries(world.entities)) {
      // Every entity should have at least a position component
      if (!HashMap.has(world.components.position, entityId)) {
        errors.push(`Entity ${entityId} missing position component`)
      }
    }

    // Check component consistency
    for (const [componentName, componentMap] of Object.entries(world.components)) {
      for (const [entityId] of HashMap.entries(componentMap)) {
        if (!HashMap.has(world.entities, entityId)) {
          errors.push(`Component ${componentName} references non-existent entity ${entityId}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}