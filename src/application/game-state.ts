import { Effect, Ref, Schema, Clock, Data } from 'effect'
import { PlayerService, PlayerError } from '@/domain'
import { PlayerId, Position, PhysicsBodyId } from '@/shared/kernel'
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
export type TimingState = Schema.Schema.Type<typeof TimingStateSchema>

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
 * Player physics body ID constant (legacy string, kept for external compatibility)
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

      // Opaque physics body ID for the player (replaces CANNON.Body ref)
      const playerBodyIdRef = yield* Ref.make<PhysicsBodyId | null>(null)
      const playerId = DEFAULT_PLAYER_ID

      // Jump override flag: when the player jumps, cannon-es contacts may persist
      // for one frame before clearing. This flag overrides isGrounded to return false
      // immediately after a jump, matching the behaviour of the old clearGroundedState.
      const jumpOverrideRef = yield* Ref.make<boolean>(false)

      /**
       * Internal helper: get whether the player is currently grounded,
       * applying the jump override when necessary.
       */
      const getIsGrounded = (playerBodyId: PhysicsBodyId): Effect.Effect<boolean, never> =>
        Effect.gen(function* () {
          const jumpOverride = yield* Ref.get(jumpOverrideRef)
          const physicsGrounded = yield* physicsService.isGrounded(playerBodyId).pipe(
            Effect.catchAll(() => Effect.succeed(false))
          )
          if (jumpOverride) {
            // Once the physics contacts have cleared, remove the override
            if (!physicsGrounded) {
              yield* Ref.set(jumpOverrideRef, false)
            }
            return false
          }
          return physicsGrounded
        })

      return {
        initialize: (spawnPosition: Position, groundY = 0): Effect.Effect<void, GameStateError> =>
          Effect.gen(function* () {
            // Initialize the physics world
            yield* physicsService.initialize({
              gravity: { x: 0, y: -9.82, z: 0 },
              broadphase: 'naive',
            })

            // Create the ground plane at terrain surface height
            yield* physicsService.addBody({
              mass: 0,
              position: { x: 0, y: groundY, z: 0 },
              shape: 'plane',
              type: 'static',
            })

            // Create player body at spawn position
            const playerBodyId = yield* physicsService.addBody({
              mass: 70,
              position: spawnPosition,
              shape: 'box',
              shapeParams: {
                halfExtents: { x: 0.3, y: 0.9, z: 0.3 },
              },
              fixedRotation: true,
              angularDamping: 1,
              allowSleep: false,
            })
            yield* Ref.set(playerBodyIdRef, playerBodyId)

            // Initialize player state at spawn position
            yield* playerService.create(playerId, spawnPosition)
          }).pipe(
            Effect.mapError((e) => {
              if (e._tag === 'PhysicsServiceError') {
                return new GameStateError({ operation: 'initialize', reason: e.operation, cause: e })
              }
              return new GameStateError({ operation: 'initialize', reason: String(e), cause: e })
            })
          ),

        update: (deltaTime: number): Effect.Effect<void, GameStateError> =>
          Effect.gen(function* () {
            const playerBodyId = yield* Ref.get(playerBodyIdRef)

            if (playerBodyId === null) {
              return yield* Effect.fail(
                new GameStateError({ operation: 'update', reason: 'Physics not initialized. Call initialize() first.' })
              )
            }

            // Get camera yaw for movement direction
            const rotation = yield* cameraState.getRotation()
            const yaw = rotation.yaw

            // Check if player is grounded (respects jump override)
            const isGrounded = yield* getIsGrounded(playerBodyId)

            // Get current physics velocity for Y preservation
            const currentVel = yield* physicsService.getVelocity(playerBodyId).pipe(
              Effect.catchAll(() => Effect.succeed({ x: 0, y: 0, z: 0 }))
            )
            const currentVelY = currentVel.y

            // Calculate movement velocity based on input
            const velocity = yield* movementService.update(
              yaw,
              isGrounded
            )

            // Apply velocity to physics body
            // Y velocity handling:
            // - If velocity.y > 0: Player intentionally jumped, apply jump velocity
            // - If velocity.y <= 0: Not jumping, preserve current Y velocity (gravity)
            const jumped = velocity.y > 0
            yield* physicsService.setVelocity(playerBodyId, {
              x: velocity.x,
              y: jumped ? velocity.y : currentVelY,
              z: velocity.z,
            })

            // Set jump override so grounded state clears immediately on jump
            if (jumped) {
              yield* Ref.set(jumpOverrideRef, true)
            }

            // Step physics simulation
            yield* physicsService.step(deltaTime)

            // Sync physics position back to player state
            const pos = yield* physicsService.getPosition(playerBodyId)
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
              if (e._tag === 'GameStateError') {
                return e
              }
              if (e._tag === 'PhysicsServiceError') {
                return new GameStateError({ operation: 'update', reason: e.operation, cause: e })
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
          Effect.gen(function* () {
            const playerBodyId = yield* Ref.get(playerBodyIdRef)
            if (playerBodyId === null) return false
            return yield* getIsGrounded(playerBodyId)
          }),
      }
    }),
  }
) {}
export const GameStateServiceLive = GameStateService.Default
