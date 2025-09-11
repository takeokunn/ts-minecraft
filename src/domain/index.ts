// Domain Constants
export {
  // From constants
  ArchetypeBuilder,
  type ArchetypeBuilderType,
  ArchetypeSchema,
  type Archetype,
  createInputState,
  createArchetype,
  BLOCK_COLORS,
  BLOCK_OPACITY,
  BLOCK_TEXTURES,
  BLOCK_MATERIAL_PROPERTIES,
  type BlockType,
  ALL_BLOCK_TYPES,
  BlockPropertiesUtils,
  BlockTypeSchema,
  blockTypeNames,
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
  CHUNK_VOLUME,
  WORLD_HEIGHT_RANGE,
  SURFACE_LEVEL,
  UNDERGROUND_LEVEL,
} from './constants'

// Domain Entities
export {
  PlayerInventory,
  Player,
  PlayerBusinessLogic,
  createPlayer,
  type Player as PlayerType,
  PlacedBlockSchema,
  FaceNameSchema,
  hotbarSlots,
  ATLAS_SIZE_IN_TILES,
  TILE_SIZE,
  getUvForFace,
  isBlockTransparent,
  isBlockFluid,
  createPlacedBlock,
  type PlacedBlock,
  type FaceName,
  type BlockType as BlockTypeFromEntity,
  makeEmptyChunk,
  ChunkBusinessLogic,
  type Chunk as ChunkType,
  WorldState,
  type WorldState as WorldStateType,
  BlockDefinitionSchema,
  blockDefinitions,
  type BlockDefinition,
  type BlockDefinitions,
} from './entities'

// Domain Errors
export * from './errors'

// Domain Ports
export * from './ports'

// Domain Services
export * from './services'

// Domain Types
export * from './types'

// Domain Utils
export * from './utils'

// Domain Value Objects
export * from './value-objects'
