// Domain Constants - Essential exports only
export {
  // Archetype-related exports (used in main.ts)
  ArchetypeBuilder,
  type ArchetypeBuilderType,
  ArchetypeSchema,
  type Archetype,
  createInputState,
  createArchetype,
  // Block-related constants (frequently used)
  type BlockType,
  blockTypeNames,
  BLOCK_COLORS,
  BLOCK_TEXTURES,
  BLOCK_MATERIAL_PROPERTIES,
  ALL_BLOCK_TYPES,
  BlockPropertiesUtils,
  BlockTypeSchema,
  // World constants (used in shared layer)
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  WATER_LEVEL,
  RENDER_DISTANCE,
  WORLD_DEPTH,
  MIN_WORLD_Y,
  Y_OFFSET,
  NOISE_SCALE,
  TERRAIN_HEIGHT_MULTIPLIER,
  CAVE_THRESHOLD,
  // Physics constants (used across the app)
  PLAYER_SPEED,
  JUMP_FORCE,
  GRAVITY,
  SPRINT_MULTIPLIER,
  TERMINAL_VELOCITY,
  FRICTION,
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

// Domain Entities - Core entities only
export {
  // Player-related types (internal business logic not exposed)
  Player,
  type Player as PlayerType,
  // World entities (used in CLI and services)
  WorldState,
  type WorldState as WorldStateType,
  makeEmptyChunk,
  ChunkBusinessLogic,
  type Chunk as ChunkType,
  // Block entities (frequently referenced)
  PlacedBlockSchema,
  FaceNameSchema,
  hotbarSlots,
  TILE_SIZE,
  getUvForFace,
  isBlockTransparent,
  isBlockFluid,
  createPlacedBlock,
  type PlacedBlock,
  type FaceName,
  type BlockType as BlockTypeFromEntity,
  BlockDefinitionSchema,
  blockDefinitions,
  type BlockDefinition,
  type BlockDefinitions,
} from './entities'

// Domain Errors - Frequently used errors only (used in @application/handlers)
export {
  // Base error types (commonly used)
  ValidationError,
  SystemExecutionError,
  EntityNotFoundError,
  ChunkNotLoadedError,
  WorldStateError,
  // Error utility functions
  createDomainError,
  DomainError,
} from './errors'

// Domain Ports - Essential ports only (used in tests)
export {
  // Clock port
  type IClockPort,
  ClockPort,
  // Input port
  type MouseState,
  type KeyboardState,
  type IInputPort,
  InputPort,
  // Math ports (used in performance tests)
  type Vector3Data,
  type QuaternionData,
  type RayData,
  type RaycastHit,
  type Matrix4Data,
  type IVector3Port,
  type IQuaternionPort,
  type IRayPort,
  type IMatrix4Port,
  type IMathPort,
  Vector3Port,
  QuaternionPort,
  RayPort,
  Matrix4Port,
  MathPort,
  VECTOR3_CONSTANTS,
  QUATERNION_CONSTANTS,
  MATRIX4_CONSTANTS,
  // Performance monitor port (used in tests)
  type PerformanceMonitorPort,
  // Render port (used in tests)
  type RenderPort,
} from './ports'

// Domain Services - Core services only (used in @application/handlers)
export {
  // Core domain services (used by query handlers)
  EntityDomainService,
  type EntityDomainServiceInterface,
  type EntityRepositoryPort,
  type EntityQueryPort,
  type Entity,
  PhysicsDomainService,
  type PhysicsDomainServiceInterface,
  type PhysicsPort,
  RaycastDomainService,
  type Ray,
  type RayHit,
  type GeometryPort,
  WorldDomainService,
  WorldDomainServiceLive,
  type WorldRepositoryPort,
  type ChunkRepositoryPort,
  CameraLogic,
  type CameraConfig,
  type CameraState,
  collisionSystem,
  cameraControlSystem,
  spatialGridSystem,
  targetingSystem,
} from './services'

// Domain Types - Core types only
export {
  type SoAResult,
  ChunkMeshSchema,
  type ChunkMesh,
  ChunkGenerationResultSchema,
  type ChunkGenerationResult,
  ComputationTaskSchema,
  type ComputationTask,
  UpsertChunkRenderCommandSchema,
  type UpsertChunkRenderCommand,
  RemoveChunkRenderCommandSchema,
  type RemoveChunkRenderCommand,
  RenderCommandSchema,
  type RenderCommand,
} from './types'

// Domain Utils - Essential utilities only
export {
  withErrorLog,
  withDomainError,
  withTiming,
  retryWithBackoff,
  forEachWithConcurrency,
  cached,
  withCleanup,
  withPerformanceMonitoring,
  withFallback,
  withTimeout,
  batchOperations,
  createCircuitBreaker,
  type CircuitBreakerState,
  type CircuitBreakerConfig,
  memoize,
} from './utils'

// Domain Value Objects - Core value objects only
export {
  X,
  type X as XType,
  Y,
  type Y as YType,
  Z,
  type Z as ZType,
  Position,
  type Position as PositionType,
  makePosition,
  blockTypes,
  type BlockType as BlockTypeVO,
  BlockTypeSchema as BlockTypeVOSchema,
} from './value-objects'
