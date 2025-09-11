/**
 * Predefined Query Definitions
 *
 * This file contains pre-built optimized queries for common use cases
 * in the Minecraft game, including player queries, physics queries,
 * and rendering queries.
 */

import { query, soaQuery, aosQuery } from '@application/queries/builder'

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
  movableEntities: query()
    .with('position', 'velocity')
    .without('playerControl')
    .where((entity) => {
      const velocity = entity.get('velocity')
      // Assuming velocity has a magnitude property or method
      return (
        velocity &&
        typeof velocity === 'object' &&
        'magnitude' in velocity &&
        typeof (velocity as { magnitude: unknown }).magnitude === 'number' &&
        (velocity as { magnitude: number }).magnitude > 0
      )
    })
    .named('movableEntitiesQuery')
    .priority(7)
    .buildOptimized(),

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
