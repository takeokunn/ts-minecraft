// Common types
export type {
  Maybe,
  Optional,
  Nullable,
  EffectFn,
  SyncFn,
  AsyncFn,
  EventHandler,
  Callback,
  DeepPartial,
  DeepRequired,
  Mutable,
  NonEmptyArray,
  Head,
  Tail,
  StringKeys,
  NumberKeys,
  ID,
  Result,
  Success,
  Failure,
  Point2D,
  Point3D,
  Size2D,
  Size3D,
  Rect,
  Box3D,
  Timestamp,
  Duration,
  EntityID,
  ComponentID,
  SystemID,
  MetricName,
  MetricValue,
  PerformanceMetric,
  ConfigValue,
  Config,
  EventType,
  EventPayload,
  GameEvent,
  State,
  StateUpdate,
  StateSelector,
} from './common'

// Export Brand namespace for external use
export { Brand } from './common'

// Game-specific types
export type {
  BlockType,
  WorldPosition,
  ChunkPosition,
  BlockPosition,
  ChunkID,
  ChunkData,
  PlayerID,
  PlayerInput,
  GameMode,
  BiomeType,
  TerrainFeature,
  ItemType,
  ItemStack,
  InventorySlot,
  Inventory,
  Velocity,
  CollisionBox,
  RenderDistance,
  LODLevel,
  MeshData,
  ServerMessage,
  ClientMessage,
  GameMetrics,
  WorldEvent,
  GameState,
} from './game'

// Schemas and constants
export { BlockTypeSchema, blockTypeNames } from './game'

// External type definitions
export * from './external'
