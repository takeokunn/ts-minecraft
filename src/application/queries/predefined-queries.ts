/**
 * Predefined Query Definitions
 *
 * This file contains pre-built optimized queries for common use cases
 * in the Minecraft game, including player queries, physics queries,
 * and rendering queries.
 */

import { query, soaQuery, aosQuery } from '@application/queries/builder'
import * as S from '@effect/schema/Schema'
import { Effect } from 'effect'

// Schema definitions for velocity validation
const VelocitySchema = S.Struct({
  magnitude: S.Number,
  x: S.optional(S.Number),
  y: S.optional(S.Number),
  z: S.optional(S.Number),
})

// Validation utility for velocity components
const validateVelocity = (velocity: unknown): Effect.Effect<{ magnitude: number; x?: number; y?: number; z?: number } | null, never, never> => {
  if (velocity == null) return Effect.succeed(null)

  if (typeof velocity === 'object' && velocity !== null) {
    const v = velocity as Record<string, unknown>
    if ('magnitude' in v && typeof v.magnitude === 'number') {
      return Effect.succeed({
        magnitude: v.magnitude,
        x: typeof v.x === 'number' ? v.x : undefined,
        y: typeof v.y === 'number' ? v.y : undefined,
        z: typeof v.z === 'number' ? v.z : undefined,
      })
    }
  }

  return Effect.succeed(null)
}

// Safe velocity check function
const hasValidVelocity = (entity: { get?: (key: string) => unknown }) => {
  const velocity = entity.get?.('velocity')
  const validatedVelocity = Effect.runSync(validateVelocity(velocity))
  return validatedVelocity !== null && validatedVelocity.magnitude > 0
}

// Predefined optimized queries for common use cases
export const queries = {
  /**
   * Player entity with all movement-related components
   */
  player: query().with('playerControl', 'position', 'velocity', 'camera', 'inventory').named('playerQuery').priority(10).buildOptimized(),

  /**
   * Player entity for block interaction/targeting
   */
  playerTarget: query().with('playerControl', 'position', 'target', 'inventory').named('playerTargetQuery').priority(9).buildOptimized(),

  /**
   * Player entity for collision detection
   */
  playerCollider: query().with('playerControl', 'position', 'velocity', 'collider').named('playerColliderQuery').priority(8).buildOptimized(),

  /**
   * Any entity with position and collider for obstacle detection
   */
  positionCollider: query().with('position', 'collider').named('positionColliderQuery').priority(7).buildOptimized(),

  /**
   * Entities affected by physics (gravity)
   */
  physics: query().with('position', 'velocity', 'playerControl').named('physicsQuery').priority(6).buildOptimized(),

  /**
   * Chunk marker entities
   */
  chunk: query().with('mesh').named('chunkQuery').priority(5).buildOptimized(),

  /**
   * Chunk loader state entity
   */
  chunkLoader: query().with('renderable').named('chunkLoaderQuery').priority(5).buildOptimized(),

  /**
   * Player entity for movement calculations
   */
  playerMovement: query().with('playerControl', 'velocity', 'camera').named('playerMovementQuery').priority(8).buildOptimized(),

  /**
   * Player entity for input handling
   */
  playerInput: query().with('playerControl').named('playerInputQuery').priority(9).buildOptimized(),

  /**
   * Terrain blocks for raycasting and world manipulation
   */
  terrainBlock: query().with('mesh', 'position').named('terrainBlockQuery').priority(6).buildOptimized(),

  /**
   * Movable entities (have velocity and position, not frozen)
   */
  movableEntities: query().with('position', 'velocity').without('playerControl').where(hasValidVelocity).named('movableEntitiesQuery').priority(7).buildOptimized(),

  /**
   * Renderable entities with positions
   */
  renderable: query().with('position', 'renderable').named('renderableQuery').priority(8).buildOptimized(),

  /**
   * Instanced mesh renderables for efficient rendering
   */
  instancedMesh: query().with('position', 'renderable').named('instancedMeshQuery').priority(7).buildOptimized(),

  /**
   * Entities with cameras
   */
  camera: query().with('camera', 'position').named('cameraQuery').priority(9).buildOptimized(),

  /**
   * Target blocks for interaction highlighting
   */
  targetBlock: query().with('target', 'position').named('targetBlockQuery').priority(8).buildOptimized(),
}

// SoA queries for bulk operations
export const soaQueries = {
  /**
   * Position and velocity data for physics calculations
   */
  physics: soaQuery('position', 'velocity'),

  /**
   * Position data for spatial queries
   */
  positions: soaQuery('position'),

  /**
   * Renderable positions for efficient rendering
   */
  renderables: soaQuery('position', 'renderable'),
}

// AoS queries for entity-centric operations
export const aosQueries = {
  /**
   * Player entities with full component data
   */
  players: aosQuery('playerControl', 'position', 'velocity'),

  /**
   * Terrain blocks with position data
   */
  terrainBlocks: aosQuery('mesh', 'position'),
}
