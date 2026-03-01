import { Effect, Layer, Ref, Schema, Clock, Data } from 'effect'
import * as CANNON from 'cannon-es'
import { PlayerService, PlayerError, isPhysicsError } from '@/domain'
import { PlayerId, Position } from '@/shared/kernel'
import { PhysicsService } from './physics/physics-service'
import { MovementService } from './player/movement-service'
import { PlayerCameraState } from '../domain/player-camera'

/**
 * Schema for TimingState representing frame timing information
 */
export const TimingStateSchema = Schema.Struct({
  lastFrameTime: Schema.Number,
  deltaTime: Schema.Number,
  frameCount: Schema.Number,
})

/**
 * Timing state interface for tracking frame timing
 */
export interface TimingState {
  readonly lastFrameTime: number
  readonly deltaTime: number
  readonly frameCount: number
}

/**
 * Error type for game state operations
 */
export class GameStateError extends Data.TaggedError('GameStateError')<{
  readonly operation: string
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = this.cause instanceof Error ? this.cause.message : this.cause ? String(this.cause) : ''
    return `GameState error during ${this.operation}: ${this.reason}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

/**
 * Type guard for GameStateError
 */
export const isGameStateError = (error: unknown): error is GameStateError =>
  typeof error === 'object' && error !== null && '_tag' in error && (error as { _tag: string })._tag === 'GameStateError'

/**
 * Player physics body ID constant
 */
export const PLAYER_BODY_ID = 'player'

/**
 * Default player ID constant
 */
export const DEFAULT_PLAYER_ID = 'player-1' as PlayerId

/**
 * Service class for coordinating game state across services
 */
export class GameStateService extends Effect.Service<GameStateService>()(
  '@minecraft/application/GameStateService',
  {
    effect: Effect.gen(function* () {
      const playerService = yield* PlayerService
      const physicsService = yield* PhysicsService
      const movementService = yield* MovementService
      const cameraState = yield* PlayerCameraState

      // Timing state
      const timingStateRef = yield* Ref.make<TimingState>({
        lastFrameTime: 0,
        deltaTime: 0,
        frameCount: 0,
      })

      // Physics world and player body references
      let worldRef: CANNON.World | null = null
      let playerBodyRef: CANNON.Body | null = null
      const playerId = DEFAULT_PLAYER_ID

      return {
        initialize: (spawnPosition: Position, groundY = 0): Effect.Effect<void, GameStateError> =>
          Effect.gen(function* () {
            // Create physics scene (world + ground at terrain surface level)
            const scene = yield* physicsService.initializeScene(groundY)
            worldRef = scene.world

            // Create player body at spawn position
            playerBodyRef = yield* physicsService.createPlayerBody(
              PLAYER_BODY_ID,
              spawnPosition
            )

            // Initialize player state at spawn position
            yield* playerService.create(playerId, spawnPosition)
          }).pipe(
            Effect.mapError((e) => {
              if (isPhysicsError(e)) {
                return new GameStateError({ operation: 'initialize', reason: e.reason, cause: e })
              }
              return new GameStateError({ operation: 'initialize', reason: String(e), cause: e })
            })
          ),

        update: (deltaTime: number): Effect.Effect<void, GameStateError> =>
          Effect.gen(function* () {
            if (!worldRef || !playerBodyRef) {
              return yield* Effect.fail(
                new GameStateError({ operation: 'update', reason: 'Physics not initialized. Call initialize() first.' })
              )
            }

            // Get camera yaw for movement direction
            const rotation = yield* cameraState.getRotation()
            const yaw = rotation.yaw

            // Check if player is grounded
            const isGrounded = yield* physicsService.isGrounded(PLAYER_BODY_ID)

            // Get current physics velocity for Y preservation
            const currentVelY = playerBodyRef.velocity.y

            // Calculate movement velocity based on input
            const velocity = yield* movementService.update(
              yaw,
              isGrounded
            )

            // Apply velocity to physics body
            // Y velocity handling:
            // - If velocity.y > 0: Player intentionally jumped, apply jump velocity
            // - If velocity.y <= 0: Not jumping, preserve current Y velocity (gravity)
            yield* physicsService.setVelocity(PLAYER_BODY_ID, {
              x: velocity.x,
              y: velocity.y > 0 ? velocity.y : currentVelY,
              z: velocity.z,
            })

            // Clear grounded state if jumping (velocity.y > 0 indicates jump)
            if (velocity.y > 0) {
              yield* physicsService.clearGroundedState(PLAYER_BODY_ID)
            }

            // Step physics simulation
            yield* physicsService.step(worldRef, deltaTime)

            // Sync physics position back to player state
            const pos = playerBodyRef.position
            yield* playerService.updatePosition(playerId, {
              x: pos.x,
              y: pos.y,
              z: pos.z,
            })

            // Update timing state
            const now = yield* Clock.currentTimeMillis
            yield* Ref.update(timingStateRef, (state) => ({
              lastFrameTime: now,
              deltaTime,
              frameCount: state.frameCount + 1,
            }))
          }).pipe(
            Effect.mapError((e) => {
              if (e instanceof GameStateError) {
                return e
              }
              if (isPhysicsError(e)) {
                return new GameStateError({ operation: 'update', reason: e.reason, cause: e })
              }
              return new GameStateError({ operation: 'update', reason: String(e), cause: e })
            })
          ),

        getTiming: (): Effect.Effect<TimingState, never> => Ref.get(timingStateRef),

        getPlayerPosition: (playerId: PlayerId): Effect.Effect<Position, PlayerError> =>
          playerService.getPosition(playerId),

        getCameraRotation: (): Effect.Effect<{ yaw: number; pitch: number }, never> =>
          cameraState.getRotation(),

        isPlayerGrounded: (): Effect.Effect<boolean, never> =>
          physicsService.isGrounded(PLAYER_BODY_ID),
      }
    }),
  }
) {}
export { GameStateService as GameStateServiceLive }
