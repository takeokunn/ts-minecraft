// Domain ID schemas and branded constructors
export {
  WorldIdSchema,
  WorldId,
  PlayerIdSchema,
  PlayerId,
  BlockIdSchema,
  BlockId,
  PhysicsBodyIdSchema,
  PhysicsBodyId,
  RecipeIdSchema,
  RecipeId,
} from './ids'

// Domain numeric schemas and branded constructors
export {
  SlotIndexSchema,
  SlotIndex,
  DeltaTimeSecsSchema,
  DeltaTimeSecs,
  BlockIndexSchema,
  BlockIndex,
} from './numerics'

// Spatial data schemas
export { PositionSchema } from './position'
export type { Position } from './position'

// Cache key schemas and branded constructors
export {
  ChunkCacheKeySchema,
  ChunkCacheKey,
  TextureUrlSchema,
  TextureUrl,
  MaterialCacheKeySchema,
  MaterialCacheKey,
} from './cache-keys'

// Physics data schemas and branded constructors
export { MetersPerSecSchema, MetersPerSec } from './physics'

// Gameplay data schemas
export { GameModeSchema, DEFAULT_GAME_MODE } from './game-mode'
export type { GameMode } from './game-mode'

export { BlockTypeSchema } from './block-type'
export type { BlockType } from './block-type'

export { ItemTypeSchema } from './item-type'
export type { ItemType } from './item-type'

export { InventoryItemSchema } from './inventory-item'
export type { InventoryItem } from './inventory-item'

export { InventorySaveDataSchema } from './inventory-save-data'
export type { InventorySaveData, InventorySlotSaveEntry } from './inventory-save-data'

// Chunk coordinate schemas and constants
export { ChunkCoordSchema, CHUNK_SIZE, CHUNK_HEIGHT } from './chunk-coords'
export type { ChunkCoord } from './chunk-coords'

// Math schemas
export { Vector3Schema, QuaternionSchema, ColorSchema } from './math'
export type { Vector3, Quaternion, Color } from './math'

// Rendering constants shared across bounded contexts
export { MAX_SHADOW_HALF_EXTENT } from './rendering-constants'
