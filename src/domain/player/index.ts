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
  PositionComponent,
  RotationComponent,
  PlayerPosition,
  PlayerRotation,
  PlayerState,
} from './PlayerService'

// Schema and validation exports (runtime values)
export {
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
} from './PlayerService'

// Type-only exports for schemas
export type {
  PlayerPosition as PlayerPositionType,
  PlayerRotation as PlayerRotationType,
  PlayerState as PlayerStateType,
  PlayerConfig as PlayerConfigType,
  PlayerError as PlayerErrorType,
  PlayerErrorReason as PlayerErrorReasonType,
  PlayerUpdateData as PlayerUpdateDataType,
} from './PlayerService'

// Service implementation
export { PlayerServiceLive } from './PlayerServiceLive'

// Movement System exports
export { MovementSystem } from './MovementSystem'
export type { MovementInput, VelocityVector, MovementState, PhysicsResult, MovementDirection } from './MovementSystem'
export {
  PHYSICS_CONSTANTS,
  PhysicsUtils,
  InputUtils,
  validateMovementInput,
  validateMovementState,
  validateVelocityVector,
  DEFAULT_MOVEMENT_STATE,
} from './MovementSystem'
export { MovementSystemLive } from './MovementSystemLive'
