// Archetypes
export {
  ArchetypeBuilder,
  type ArchetypeBuilder as ArchetypeBuilderType,
  ArchetypeSchema,
  type Archetype,
  createInputState,
  createArchetype
} from './archetypes'

// Block Properties
export {
  BLOCK_COLORS,
  BLOCK_OPACITY,
  BLOCK_TEXTURES,
  BLOCK_MATERIAL_PROPERTIES,
  type BlockType,
  ALL_BLOCK_TYPES,
  BlockPropertiesUtils
} from './block-properties'

// Block Types
export {
  BlockTypeSchema,
  type BlockType as BlockTypeFromSchema,
  blockTypeNames
} from './block-types'

// World Constants
export {
  // Re-exported from shared
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  WATER_LEVEL,
  WORLD_DEPTH,
  MIN_WORLD_Y,
  Y_OFFSET,
  RENDER_DISTANCE,
  NOISE_SCALE,
  TERRAIN_HEIGHT_MULTIPLIER,
  CAVE_THRESHOLD,
  PLAYER_SPEED,
  SPRINT_MULTIPLIER,
  JUMP_FORCE,
  TERMINAL_VELOCITY,
  FRICTION,
  GRAVITY,
  DECELERATION,
  MIN_VELOCITY_THRESHOLD,
  PLAYER_HEIGHT,
  PLAYER_COLLIDER,
  BLOCK_COLLIDER,
  // Domain-specific constants
  CHUNK_VOLUME,
  WORLD_HEIGHT_RANGE,
  SURFACE_LEVEL,
  UNDERGROUND_LEVEL
} from './world-constants'