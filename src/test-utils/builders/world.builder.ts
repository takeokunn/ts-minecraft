import { pipe, Effect } from 'effect'
import { EntityId, toEntityId } from '@/domain/entity'
import { Archetype } from '@/domain/archetypes'
import { Position, Velocity } from '@/core/values'
import { BlockType } from '@/domain/block-types'
import { World } from '@/services/world'

/**
 * World Builder - Fluent API for creating test worlds
 * Uses immutable state pattern for functional composition
 */

// Builder state type
type WorldBuilderState = {
  readonly entities: ReadonlyMap<EntityId, Archetype>
  readonly nextId: number
}

// Initial state
const initialState: WorldBuilderState = {
  entities: new Map(),
  nextId: 1
}

/**
 * World builder functions
 */
export const worldBuilder = {
  /**
   * Create a new builder
   */
  create: (): WorldBuilderState => initialState,
  
  /**
   * Add a player entity
   */
  withPlayer: (position: { x: number; y: number; z: number }) =>
    (state: WorldBuilderState): WorldBuilderState => {
      const entityId = toEntityId(state.nextId)
      const archetype: Archetype = {
        components: {
          position: { x: position.x, y: position.y, z: position.z },
          velocity: { dx: 0, dy: 0, dz: 0 },
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
          cameraState: { pitch: 0, yaw: 0 },
          collider: { width: 0.6, height: 1.8, depth: 0.6 },
          gravity: { value: -32 },
          hotbar: {
            slots: Array(9).fill(BlockType.AIR),
            selectedIndex: 0
          },
          target: { _tag: 'none' as const }
        }
      }
      
      return {
        entities: new Map(state.entities).set(entityId, archetype),
        nextId: state.nextId + 1
      }
    },
  
  /**
   * Add a block entity
   */
  withBlock: (position: { x: number; y: number; z: number }, blockType: BlockType) =>
    (state: WorldBuilderState): WorldBuilderState => {
      const entityId = toEntityId(state.nextId)
      const archetype: Archetype = {
        components: {
          position: { x: position.x, y: position.y, z: position.z },
          renderable: {
            geometry: 'cube',
            blockType
          },
          collider: { width: 1, height: 1, depth: 1 },
          terrainBlock: {},
          targetBlock: {}
        }
      }
      
      return {
        entities: new Map(state.entities).set(entityId, archetype),
        nextId: state.nextId + 1
      }
    },
  
  /**
   * Add multiple blocks in a pattern
   */
  withBlockGrid: (
    origin: { x: number; y: number; z: number },
    width: number,
    depth: number,
    blockType: BlockType
  ) => (state: WorldBuilderState): WorldBuilderState => {
    let newState = state
    
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        newState = worldBuilder.withBlock(
          { 
            x: origin.x + x, 
            y: origin.y, 
            z: origin.z + z 
          },
          blockType
        )(newState)
      }
    }
    
    return newState
  },
  
  /**
   * Add a custom entity with specific components
   */
  withEntity: (archetype: Archetype) =>
    (state: WorldBuilderState): WorldBuilderState => {
      const entityId = toEntityId(state.nextId)
      
      return {
        entities: new Map(state.entities).set(entityId, archetype),
        nextId: state.nextId + 1
      }
    },
  
  /**
   * Build the world (requires World service in context)
   */
  build: (state: WorldBuilderState): Effect.Effect<void, never, World> =>
    Effect.gen(function* () {
      const world = yield* World
      
      // Add all entities to the world
      for (const [_, archetype] of state.entities) {
        yield* world.addArchetype(archetype)
      }
    }),
  
  /**
   * Build and return the world service
   */
  buildWithService: (state: WorldBuilderState): Effect.Effect<World, never, World> =>
    Effect.gen(function* () {
      const world = yield* World
      
      // Add all entities to the world
      for (const [_, archetype] of state.entities) {
        yield* world.addArchetype(archetype)
      }
      
      return world
    })
}

/**
 * Usage examples:
 * 
 * const worldState = pipe(
 *   worldBuilder.create(),
 *   worldBuilder.withPlayer({ x: 0, y: 64, z: 0 }),
 *   worldBuilder.withBlock({ x: 0, y: 63, z: 0 }, BlockType.GRASS),
 *   worldBuilder.withBlockGrid({ x: -5, y: 62, z: -5 }, 10, 10, BlockType.STONE)
 * )
 * 
 * const program = pipe(
 *   worldState,
 *   worldBuilder.build
 * )
 */