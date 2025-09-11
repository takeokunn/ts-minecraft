/**
 * Predefined Query Configurations
 * 
 * This module contains query configuration templates for common use cases
 * in the domain layer. These configurations can be used to create queries
 * within the Effect context using the query services.
 */

import { soaQuery, aosQuery } from './builder'

/**
 * Predefined query configurations for common use cases
 */
export const queryConfigs = {
  /**
   * Player entity with all movement-related components
   */
  player: {
    name: 'playerQuery',
    withComponents: ['playerControl', 'position', 'velocity', 'camera', 'inventory'] as const,
    priority: 10,
  },

  /**
   * Player entity for block interaction/targeting
   */
  playerTarget: {
    name: 'playerTargetQuery',
    withComponents: ['playerControl', 'position', 'target', 'inventory'] as const,
    priority: 9,
  },

  /**
   * Player entity for collision detection
   */
  playerCollider: {
    name: 'playerColliderQuery',
    withComponents: ['playerControl', 'position', 'velocity', 'collider'] as const,
    priority: 8,
  },

  /**
   * Any entity with position and collider for obstacle detection
   */
  positionCollider: {
    name: 'positionColliderQuery',
    withComponents: ['position', 'collider'] as const,
    priority: 7,
  },

  /**
   * Entities affected by physics (gravity)
   */
  physics: {
    name: 'physicsQuery',
    withComponents: ['position', 'velocity', 'playerControl'] as const,
    priority: 6,
  },

  /**
   * Chunk marker entities
   */
  chunk: {
    name: 'chunkQuery',
    withComponents: ['mesh'] as const,
    priority: 5,
  },

  /**
   * Chunk loader state entity
   */
  chunkLoader: {
    name: 'chunkLoaderQuery',
    withComponents: ['renderable'] as const,
    priority: 5,
  },

  /**
   * Player entity for movement calculations
   */
  playerMovement: {
    name: 'playerMovementQuery',
    withComponents: ['playerControl', 'velocity', 'camera'] as const,
    priority: 8,
  },

  /**
   * Player entity for input handling
   */
  playerInput: {
    name: 'playerInputQuery',
    withComponents: ['playerControl'] as const,
    priority: 9,
  },

  /**
   * Terrain blocks for raycasting and world manipulation
   */
  terrainBlock: {
    name: 'terrainBlockQuery',
    withComponents: ['mesh', 'position'] as const,
    priority: 6,
  },

  /**
   * Movable entities (have velocity and position, not frozen)
   */
  movableEntities: {
    name: 'movableEntitiesQuery',
    withComponents: ['position', 'velocity'] as const,
    withoutComponents: ['playerControl'],
    predicate: (entity: any) => {
      const velocity = entity.get('velocity')
      // Assuming velocity has a magnitude property or method
      return (
        velocity &&
        typeof velocity === 'object' &&
        'magnitude' in velocity &&
        typeof (velocity as { magnitude: unknown }).magnitude === 'number' &&
        (velocity as { magnitude: number }).magnitude > 0
      )
    },
    priority: 7,
  },

  /**
   * Renderable entities with positions
   */
  renderable: {
    name: 'renderableQuery',
    withComponents: ['position', 'renderable'] as const,
    priority: 8,
  },

  /**
   * Instanced mesh renderables for efficient rendering
   */
  instancedMesh: {
    name: 'instancedMeshQuery',
    withComponents: ['position', 'renderable'] as const,
    priority: 7,
  },

  /**
   * Entities with cameras
   */
  camera: {
    name: 'cameraQuery',
    withComponents: ['camera', 'position'] as const,
    priority: 9,
  },

  /**
   * Target blocks for interaction highlighting
   */
  targetBlock: {
    name: 'targetBlockQuery',
    withComponents: ['target', 'position'] as const,
    priority: 8,
  },
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