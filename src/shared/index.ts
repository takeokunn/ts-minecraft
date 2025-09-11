// Shared Layer - Named exports for better tree-shaking and explicit dependencies

// Constants
export {
  // Performance constants
  FPS_UPDATE_INTERVAL,
  MAX_FPS,
  FRAME_TIME_BUDGET,
  
  // Physics constants
  GRAVITY,
  PHYSICS_TIME_STEP,
  MAX_PHYSICS_SUBSTEPS,
  
  // UI constants
  DEBUG_PANEL_WIDTH,
  DEBUG_PANEL_HEIGHT,
  CHAT_HISTORY_SIZE,
  
  // World constants
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  WATER_LEVEL,
  WORLD_DEPTH,
  MIN_WORLD_Y,
  Y_OFFSET,
  RENDER_DISTANCE,
  NOISE_SCALE,
  TERRAIN_HEIGHT_MULTIPLIER,
  CAVE_THRESHOLD
} from './constants'

// Decorators
export {
  measureTime,
  throttle,
  debounce,
  memoize,
  logCalls
} from './decorators'

// Types - explicit exports for better tree-shaking
export type {
  // Common types
  Maybe,
  Optional,
  Nullable,
  Fn,
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
  Brand,
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
  
  // Game-specific types
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
  GameState
} from './types'

// Game schemas and constants
export {
  BlockTypeSchema,
  blockTypeNames
} from './types'

// Utilities - explicit exports for better tree-shaking and transparency
export {
  // Error handling utilities
  type ErrorHandlingStrategy,
  type ErrorHandlingContext,
  type RetryConfig,
  type ErrorHandler,
  ErrorHandlers,
  ErrorRecovery,
  PerformanceAwareErrorHandling,
  ErrorReporting,
  createComponentErrorHandler,
  withErrorHandling,
  handleError,
  recoverFromError,
  reportErrors,
  
  // Logging utilities
  type LogLevel,
  type LogEntry,
  type LoggerConfig,
  Logger,
  createComponentLogger,
  DevLogger,
  
  // Monitoring utilities
  type PerformanceMetrics,
  type HealthCheck,
  type SystemStatus,
  type MonitoringConfig,
  registerHealthCheck,
  PerformanceMonitor,
  HealthMonitor,
  withMonitoring,
  createComponentMonitor,
  
  // Validation utilities
  type ValidationResult,
  type ValidationContext,
  type ValidatorFn,
  type ValidationRule,
  Validators,
  ValidationChain,
  ValidationUtils,
  GameValidators,
  createComponentValidator,
  
  // Common utilities
  isNotNull,
  isNotUndefined,
  isNotNullish,
  safeArrayAccess,
  deepClone,
  // Note: debounce, throttle exported twice, removing duplicate
  range,
  // Note: memoize exported twice, removing duplicate
  groupBy,
  unique,
  chunk,
  flatten,
  generateId,
  formatBytes,
  sleep,
  retry,
  
  // Effect utilities
  withErrorLog,
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
  
  // Math utilities
  Float,
  type FloatType,
  toFloat,
  Int,
  type IntType,
  toInt,
  clamp,
  lerp,
  smoothstep,
  inverseLerp,
  Vector2,
  type Vector2Type,
  createVector2,
  Vector3,
  type Vector3Type,
  createVector3,
  VectorOps
} from './utils'
