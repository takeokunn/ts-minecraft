/**
 * PlayerService - ECS-based Player Management
 *
 * Effect-TS Service implementation for player management with:
 * - ECS EntityManager integration
 * - Schema-validated type safety
 * - Functional error handling
 * - Component-based state management
 */

// Service interface
export { PlayerService } from './PlayerService.js'

// Type-only exports
export type { PlayerComponent, PositionComponent, RotationComponent } from './PlayerService.js'

// Schema and validation exports (runtime values)
export {
  PlayerPosition,
  PlayerRotation,
  PlayerState,
  PlayerConfig,
  PlayerUpdateData,
  PlayerErrorReason,
  PlayerError,
  createPlayerError,
  isPlayerError,
  validatePlayerConfig,
  validatePlayerState,
  validatePlayerPosition,
  validatePlayerRotation,
  validatePlayerUpdateData,
  DEFAULT_PLAYER_CONFIG,
} from './PlayerService.js'

// Type-only exports for schemas
export type {
  PlayerPosition as PlayerPositionType,
  PlayerRotation as PlayerRotationType,
  PlayerState as PlayerStateType,
  PlayerConfig as PlayerConfigType,
  PlayerError as PlayerErrorType,
  PlayerErrorReason as PlayerErrorReasonType,
  PlayerUpdateData as PlayerUpdateDataType,
} from './PlayerService.js'

// Service implementation
export { PlayerServiceLive } from './PlayerServiceLive.js'

// Movement System exports
export { MovementSystem } from './MovementSystem.js'
export type {
  MovementInput,
  VelocityVector,
  MovementState,
  PhysicsResult,
  MovementDirection,
} from './MovementSystem.js'
export {
  PHYSICS_CONSTANTS,
  PhysicsUtils,
  InputUtils,
  validateMovementInput,
  validateMovementState,
  validateVelocityVector,
  DEFAULT_MOVEMENT_STATE,
} from './MovementSystem.js'
export { MovementSystemLive } from './MovementSystemLive.js'
