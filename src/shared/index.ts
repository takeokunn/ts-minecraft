// Shared Layer - Named exports for better tree-shaking and explicit dependencies

// Constants - Frequently used constants only
export {
  // Physics constants (used in game config)
  GRAVITY,
  PLAYER_SPEED,
  JUMP_FORCE,
  PHYSICS_TIME_STEP,
  MAX_PHYSICS_SUBSTEPS,
  SPRINT_MULTIPLIER,
  TERMINAL_VELOCITY,
  FRICTION,
  DECELERATION,
  MIN_VELOCITY_THRESHOLD,
  PLAYER_HEIGHT,
  COLLISION_MARGIN,
  MAX_COLLISION_ITERATIONS,
  PLAYER_COLLIDER,
  BLOCK_COLLIDER,
  type SimpleCollider,
  // World constants (used in game config and domain)
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
} from './constants'


// Types - Core types only (used in game config)
export type {
  // Common utility types
  Maybe,
  Optional,
  Nullable,
  Result,
  Success,
  Failure,
  Point2D,
  Point3D,
  // Game-specific types
  GameMode,
  RenderDistance,
  BlockType,
  EntityID,
  GameState,
  ChunkID,
  ChunkData,
} from './types'

// Game schemas and constants
export { BlockTypeSchema, blockTypeNames } from './types'

// Utilities - Core utilities only
export {
  // Logging utilities (used in error handling and monitoring)
  type LogLevel,
  type LogEntry,
  Logger,
  // Error handling utilities (used across layers)
  type ErrorHandlingStrategy,
  type RetryConfig,
  ErrorHandlers,
  withErrorHandling,
  handleError,
  ValidationError,
  SystemError,
  EntityError,
  // Monitoring utilities (used in shared utils)
  type PerformanceMetrics,
  PerformanceMonitor,
  // Validation utilities (Schema-based)
  type ValidationResult,
  type ValidationContext,
  Validators,
  ValidationChain,
  ValidationUtils,
  GameValidators,
  // Common type guards
  isRecord,
  hasProperty,
  isFunction,
  safeBoolean,
  isVector3,
  getSafeNumberProperty,
  isHTMLElement,
  isHTMLInputElement,
  hasFiles,
  hasPerformanceMemory,
  hasPerformanceObserver,
  safeParseNumber,
  // Math utilities (used in physics)
  Float,
  type FloatType,
  toFloat,
  Int,
  type IntType,
  toInt,
  clamp,
  lerp,
  Vector3,
  type Vector3Type,
  createVector3,
  // Functional utilities (decorator replacements)
  debounce,
  throttle,
  memoize,
  withMeasurement,
  withTiming,
} from './utils'
