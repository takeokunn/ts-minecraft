import { Effect, Ref, Schema, Clock, Data, Option } from 'effect'
import { PlayerService } from '@/application/player/player-state'
import { PlayerError } from '@/domain'
import { DeltaTimeSecs, DeltaTimeSecsSchema, PlayerId, Position, PhysicsBodyId } from '@/shared/kernel'
import { PhysicsService, PLAYER_FEET_OFFSET } from './physics/physics-service'
import { MovementService } from './player/movement-service'
import { PlayerCameraStateService } from '@/application/camera/camera-state'
import { DEFAULT_PLAYER_ID, FIRST_FRAME_DELTA_SECS } from '@/application/constants'

/**
 * Schema for TimingState representing frame timing information
 */
export const TimingStateSchema = Schema.Struct({
  lastFrameTime: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  deltaTime: DeltaTimeSecsSchema,
  frameCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
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
 * Player physics body ID constant (legacy string, kept for external compatibility)
 */
export const PLAYER_BODY_ID = 'player'

/** Gravitational acceleration (m/s²) — standard Earth gravity */
const GRAVITY_Y = -9.82

/** Player rigid body mass in kg */
const PLAYER_MASS = 70

/** Player box half-extents in meters (x and z) */
const PLAYER_HALF_WIDTH = 0.3

/** Player box half-extents in meters (y) */
const PLAYER_HALF_HEIGHT = 0.9
const ZERO_VEC3 = Object.freeze({ x: 0, y: 0, z: 0 })

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
      const cameraState = yield* PlayerCameraStateService

      // Timing state (deltaTime initial value uses a first-frame estimate of 16ms at 60fps)
      const timingStateRef = yield* Ref.make<TimingState>({
        lastFrameTime: 0,
        deltaTime: DeltaTimeSecs.make(FIRST_FRAME_DELTA_SECS),
        frameCount: 0,
      })

      // Opaque physics body ID for the player (replaces CANNON.Body ref)
      const playerBodyIdRef = yield* Ref.make<Option.Option<PhysicsBodyId>>(Option.none())
      const playerId = DEFAULT_PLAYER_ID
      // Stored ground plane Y for post-step fall-through correction
      const groundYRef = yield* Ref.make<number>(0)

      // Jump override flag: when the player jumps, contact state may persist
      // for one frame before clearing. This flag overrides isGrounded to return false
      // immediately after a jump, matching the behaviour of the old clearGroundedState.
      const jumpOverrideRef = yield* Ref.make<boolean>(false)

      /**
       * Internal helper: get whether the player is currently grounded.
       * Uses position-based detection: player center Y ≤ (groundY + halfHeight + tolerance).
       * Position-threshold comparison is used instead of contact events because the post-step
       * ground clamp repositions the body without generating new contact equations.
       */
      const getIsGrounded = (playerBodyId: PhysicsBodyId): Effect.Effect<boolean, never> =>
        Effect.gen(function* () {
          const jumpOverride = yield* Ref.get(jumpOverrideRef)
          const pos = yield* physicsService.getPosition(playerBodyId).pipe(
            Effect.catchTag('PhysicsServiceError', () => Effect.succeed(ZERO_VEC3))
          )
          const gY = yield* Ref.get(groundYRef)
          // Player center is at groundY + halfHeight when standing on ground
          const groundedThresholdY = gY + PLAYER_HALF_HEIGHT + 0.15
          const isNearGround = pos.y <= groundedThresholdY
          if (jumpOverride) {
            // Clear override once player has risen above ground level
            if (!isNearGround) {
              yield* Ref.set(jumpOverrideRef, false)
            }
            return false
          }
          return isNearGround
        })

      return {
        initialize: (spawnPosition: Position, groundY = 0): Effect.Effect<void, GameStateError> =>
          Effect.gen(function* () {
            // Store ground plane Y for post-step fall-through correction
            yield* Ref.set(groundYRef, groundY)

            // Initialize the physics world
            yield* physicsService.initialize({
              gravity: { x: 0, y: GRAVITY_Y, z: 0 },
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
              mass: PLAYER_MASS,
              position: spawnPosition,
              shape: 'box',
              shapeParams: {
                halfExtents: { x: PLAYER_HALF_WIDTH, y: PLAYER_HALF_HEIGHT, z: PLAYER_HALF_WIDTH },
              },
              fixedRotation: true,
              angularDamping: 1,
              allowSleep: false,
            })
            yield* Ref.set(playerBodyIdRef, Option.some(playerBodyId))

            // Initialize player state at spawn position
            yield* playerService.create(playerId, spawnPosition)
          }).pipe(
            Effect.catchTag('PhysicsServiceError', (e) =>
              Effect.fail(new GameStateError({ operation: 'initialize', reason: e.operation, cause: e }))
            ),
            Effect.catchTag('PlayerError', (e) =>
              Effect.fail(new GameStateError({ operation: 'initialize', reason: e.reason, cause: e }))
            )
          ),

        update: (deltaTime: DeltaTimeSecs): Effect.Effect<void, GameStateError> =>
          Effect.gen(function* () {
            const playerBodyIdOpt = yield* Ref.get(playerBodyIdRef)

            if (!Option.isSome(playerBodyIdOpt)) {
              return yield* Effect.fail(
                new GameStateError({ operation: 'update', reason: 'Physics not initialized. Call initialize() first.' })
              )
            }
            const playerBodyId = playerBodyIdOpt.value

            // Get camera yaw for movement direction
            const rotation = yield* cameraState.getRotation()
            const yaw = rotation.yaw

            // Check if player is grounded (respects jump override)
            const isGrounded = yield* getIsGrounded(playerBodyId)

            // Get current physics velocity for Y preservation
            const currentVel = yield* physicsService.getVelocity(playerBodyId).pipe(
              Effect.catchTag('PhysicsServiceError', (e) =>
                Effect.logWarning(`getVelocity fallback: ${e.message ?? String(e)}`).pipe(
                  Effect.as(ZERO_VEC3)
                )
              )
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

            // Step physics simulation with ground-clamp to prevent tunneling
            const storedGroundY = yield* Ref.get(groundYRef)
            yield* physicsService.step(deltaTime, { minY: storedGroundY + PLAYER_FEET_OFFSET })

            // Sync physics position and velocity back to player state
            const pos = yield* physicsService.getPosition(playerBodyId)
            yield* playerService.updatePosition(playerId, {
              x: pos.x,
              y: pos.y,
              z: pos.z,
            })

            const finalVel = yield* physicsService.getVelocity(playerBodyId).pipe(
              Effect.catchTag('PhysicsServiceError', () =>
                Effect.succeed({ x: 0, y: 0, z: 0 })
              )
            )
            yield* playerService.updateVelocity(playerId, finalVel)

            // Update timing state
            const now = yield* Clock.currentTimeMillis
            yield* Ref.update(timingStateRef, (state) => ({
              lastFrameTime: now,
              deltaTime,
              frameCount: state.frameCount + 1,
            }))
          }).pipe(
            Effect.catchTag('PhysicsServiceError', (e) =>
              Effect.fail(new GameStateError({ operation: 'update', reason: e.operation, cause: e }))
            ),
            Effect.catchTag('PlayerError', (e) =>
              Effect.fail(new GameStateError({ operation: 'update', reason: e.reason, cause: e }))
            )
          ),

        getTiming: (): Effect.Effect<TimingState, never> => Ref.get(timingStateRef),

        getPlayerPosition: (playerId: PlayerId): Effect.Effect<Position, PlayerError> =>
          playerService.getPosition(playerId),

        getCameraRotation: (): Effect.Effect<{ yaw: number; pitch: number }, never> =>
          cameraState.getRotation(),

        isPlayerGrounded: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const playerBodyIdOpt = yield* Ref.get(playerBodyIdRef)
            if (!Option.isSome(playerBodyIdOpt)) return false
            return yield* getIsGrounded(playerBodyIdOpt.value)
          }),

        /**
         * Update the terrain ground Y used for physics clamping and grounded detection.
         * Called each frame by frame-handler with the terrain height at the player's column.
         */
        updateGroundY: (y: number): Effect.Effect<void, never> =>
          Ref.set(groundYRef, y),
      }
    }),
  }
) {}
export const GameStateServiceLive = GameStateService.Default
