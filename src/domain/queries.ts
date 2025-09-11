import { createQuery, LegacyQuery as Query } from '@/core/queries'

/**
 * Query for the main player entity, including all components needed for movement and interaction.
 */
export const playerQuery: Query = createQuery('playerQuery', ['player', 'position', 'velocity', 'inputState', 'cameraState', 'hotbar', 'gravity'])

/**
 * Query for the player entity, focusing on components needed for block interaction (targeting).
 */
export const playerTargetQuery: Query = createQuery('playerTargetQuery', ['player', 'position', 'inputState', 'target', 'hotbar'])

/**
 * Query for the player entity, focusing on components needed for collision detection.
 */
export const playerColliderQuery: Query = createQuery('playerColliderQuery', ['player', 'position', 'velocity', 'collider'])

/**
 * Query for any entity that has a position and a collider, used to find potential obstacles.
 */
export const positionColliderQuery: Query = createQuery('positionColliderQuery', ['position', 'collider'])

/**
 * Query for entities affected by physics (gravity).
 */
export const physicsQuery: Query = createQuery('physicsQuery', ['position', 'velocity', 'gravity', 'player'])

/**
 * Query for chunk marker entities.
 */
export const chunkQuery: Query = createQuery('chunkQuery', ['chunk'])

/**
 * Query for the entity holding the chunk loader state.
 */
export const chunkLoaderQuery: Query = createQuery('chunkLoaderQuery', ['chunkLoaderState'])

/**
 * Query for the player entity, focusing on components needed for calculating movement vectors.
 */
export const playerMovementQuery: Query = createQuery('playerMovementQuery', ['player', 'inputState', 'velocity', 'cameraState'])

/**
 * Query for the player entity, focusing on components related to raw input.
 */
export const playerInputQuery: Query = createQuery('playerInputQuery', ['player', 'inputState'])

/**
 * Query for all terrain blocks, used for raycasting and world manipulation.
 */
export const terrainBlockQuery: Query = createQuery('terrainBlockQuery', ['terrainBlock', 'position'])
