import { query } from './'

/**
 * Query for the main player entity, including all components needed for movement and interaction.
 */
export const playerQuery = query()
  .with('player', 'position', 'velocity', 'inputState', 'cameraState', 'hotbar', 'gravity')
  .named('playerQuery')
  .build()

/**
 * Query for the player entity, focusing on components needed for block interaction (targeting).
 */
export const playerTargetQuery = query()
  .with('player', 'position', 'inputState', 'target', 'hotbar')
  .named('playerTargetQuery')
  .build()

/**
 * Query for the player entity, focusing on components needed for collision detection.
 */
export const playerColliderQuery = query()
  .with('player', 'position', 'velocity', 'collider')
  .named('playerColliderQuery')
  .build()

/**
 * Query for any entity that has a position and a collider, used to find potential obstacles.
 */
export const positionColliderQuery = query()
  .with('position', 'collider')
  .named('positionColliderQuery')
  .build()

/**
 * Query for entities affected by physics (gravity).
 */
export const physicsQuery = query()
  .with('position', 'velocity', 'gravity', 'player')
  .named('physicsQuery')
  .build()

/**
 * Query for chunk marker entities.
 */
export const chunkQuery = query()
  .with('chunk')
  .named('chunkQuery')
  .build()

/**
 * Query for the entity holding the chunk loader state.
 */
export const chunkLoaderQuery = query()
  .with('chunkLoaderState')
  .named('chunkLoaderQuery')
  .build()

/**
 * Query for the player entity, focusing on components needed for calculating movement vectors.
 */
export const playerMovementQuery = query()
  .with('player', 'inputState', 'velocity', 'cameraState')
  .named('playerMovementQuery')
  .build()

/**
 * Query for the player entity, focusing on components related to raw input.
 */
export const playerInputQuery = query()
  .with('player', 'inputState')
  .named('playerInputQuery')
  .build()

/**
 * Query for all terrain blocks, used for raycasting and world manipulation.
 */
export const terrainBlockQuery = query()
  .with('terrainBlock', 'position')
  .named('terrainBlockQuery')
  .build()
