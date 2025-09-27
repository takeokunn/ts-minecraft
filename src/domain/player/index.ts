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
export { PlayerService } from './PlayerService'

// Type-only exports
export type {
  PlayerComponent,
  PlayerPosition,
  PlayerRotation,
  PlayerState,
  PositionComponent,
  RotationComponent,
} from './PlayerService'

// Schema and validation exports (runtime values)
export {
  DEFAULT_PLAYER_CONFIG,
  PlayerConfig,
  PlayerError,
  PlayerErrorReason,
  PlayerUpdateData,
  createPlayerError,
  isPlayerError,
  validatePlayerConfig,
  validatePlayerPosition,
  validatePlayerRotation,
  validatePlayerState,
  validatePlayerUpdateData,
} from './PlayerService'

// Type-only exports for schemas
export type {
  PlayerConfig as PlayerConfigType,
  PlayerErrorReason as PlayerErrorReasonType,
  PlayerError as PlayerErrorType,
  PlayerPosition as PlayerPositionType,
  PlayerRotation as PlayerRotationType,
  PlayerState as PlayerStateType,
  PlayerUpdateData as PlayerUpdateDataType,
} from './PlayerService'

// Service implementation
export { PlayerServiceLive } from './PlayerServiceLive'

// Movement System exports
export {
  DEFAULT_MOVEMENT_STATE,
  InputUtils,
  MovementSystem,
  PHYSICS_CONSTANTS,
  PhysicsUtils,
  validateMovementInput,
  validateMovementState,
  validateVelocityVector,
} from './MovementSystem'
export type { MovementDirection, MovementInput, MovementState, PhysicsResult, VelocityVector } from './MovementSystem'
export { MovementSystemLive } from './MovementSystemLive'
