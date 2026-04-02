import { Effect, Ref, Schema, Clock, Data, Option } from 'effect'
import { PlayerService } from '@/application/player/player-state'
import { PlayerError } from '@/domain'
import { DeltaTimeSecs, DeltaTimeSecsSchema, PlayerId, Position, PhysicsBodyId } from '@/shared/kernel'
import { PhysicsService } from './physics/physics-service'
import { MovementService } from './player/movement-service'
import { PlayerCameraStateService } from '@/application/camera/camera-state'
import { DEFAULT_PLAYER_ID, FIRST_FRAME_DELTA_SECS } from '@/application/constants'
import { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import { resolveBlockCollisions } from '@/application/physics/aabb-collision'

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
    effect: Effect.all([
      PlayerService,
      PhysicsService,
      MovementService,
      PlayerCameraStateService,
      ChunkManagerService,
      // Timing state (deltaTime initial value uses a first-frame estimate of 16ms at 60fps)
      Ref.make<TimingState>({
        lastFrameTime: 0,
        deltaTime: DeltaTimeSecs.make(FIRST_FRAME_DELTA_SECS),
        frameCount: 0,
      }),
      // Opaque physics body ID for the player (replaces CANNON.Body ref)
      Ref.make<Option.Option<PhysicsBodyId>>(Option.none()),
      // AABB-derived grounded state (updated each frame after block collision resolution)
      Ref.make<boolean>(false),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([playerService, physicsService, movementService, cameraState, chunkManagerService, timingStateRef, playerBodyIdRef, isGroundedRef]) => {
      const playerId = DEFAULT_PLAYER_ID

      return {
        initialize: (spawnPosition: Position, groundY = 0): Effect.Effect<void, GameStateError> =>
          Effect.gen(function* () {
            // Initialize the physics world
            yield* physicsService.initialize({
              gravity: { x: 0, y: GRAVITY_Y, z: 0 },
              broadphase: 'naive',
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

            // Suppress unused warning for groundY parameter (kept for API compatibility)
            void groundY
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
            const playerBodyId = yield* Option.match(yield* Ref.get(playerBodyIdRef), {
              onNone: () => Effect.fail(new GameStateError({ operation: 'update', reason: 'Physics not initialized. Call initialize() first.' })),
              onSome: (id) => Effect.succeed(id),
            })

            // Get camera yaw for movement direction
            const rotation = yield* cameraState.getRotation()
            const yaw = rotation.yaw

            // Read grounded state from last frame's AABB result
            const isGrounded = yield* Ref.get(isGroundedRef)

            // Get current physics velocity for Y preservation
            const currentVel = yield* physicsService.getVelocity(playerBodyId).pipe(
              Effect.catchTag('PhysicsServiceError', (e) =>
                Effect.logWarning(`getVelocity fallback: ${e.message ?? String(e)}`).pipe(
                  Effect.as(ZERO_VEC3)
                )
              )
            )

            // Calculate movement velocity based on input
            const velocity = yield* movementService.update(yaw, isGrounded)

            const jumped = velocity.y > 0

            // Air control: only allow horizontal movement input when grounded
            yield* physicsService.setVelocity(playerBodyId, {
              x: isGrounded ? velocity.x : currentVel.x,
              y: jumped ? velocity.y : currentVel.y,
              z: isGrounded ? velocity.z : currentVel.z,
            })

            // Clear grounded immediately on jump
            if (jumped) {
              yield* Ref.set(isGroundedRef, false)
            }

            // Step physics simulation (Euler integration + gravity)
            yield* physicsService.step(deltaTime)

            // Read post-step position and velocity
            const physPos = yield* physicsService.getPosition(playerBodyId).pipe(
              Effect.catchTag('PhysicsServiceError', () => Effect.succeed(ZERO_VEC3 as Position))
            )
            const physVel = yield* physicsService.getVelocity(playerBodyId).pipe(
              Effect.catchTag('PhysicsServiceError', () => Effect.succeed(ZERO_VEC3))
            )

            // Load surrounding chunks for block collision queries
            const playerCx = Math.floor(physPos.x / CHUNK_SIZE)
            const playerCz = Math.floor(physPos.z / CHUNK_SIZE)
            const chunkCache = new Map<string, { blocks: Uint8Array }>()
            yield* Effect.forEach(
              ([-1, 0, 1] as const).flatMap((dx) => ([-1, 0, 1] as const).map((dz) => ({ dx, dz }))),
              ({ dx, dz }) =>
                chunkManagerService.getChunk({ x: playerCx + dx, z: playerCz + dz }).pipe(
                  Effect.tap((chunk) =>
                    Effect.sync(() => {
                      chunkCache.set(`${playerCx + dx},${playerCz + dz}`, chunk)
                    })
                  ),
                  Effect.ignore
                ),
              { concurrency: 'unbounded' }
            )

            // AABB block collision resolution
            const isBlockSolid = (wx: number, wy: number, wz: number): boolean => {
              const iy = Math.floor(wy)
              if (iy < 0) return true  // bedrock floor
              if (iy >= CHUNK_HEIGHT) return false
              const bx = Math.floor(wx)
              const bz = Math.floor(wz)
              const cx = Math.floor(bx / CHUNK_SIZE)
              const cz = Math.floor(bz / CHUNK_SIZE)
              const chunk = chunkCache.get(`${cx},${cz}`)
              if (!chunk) return false
              const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
              const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
              return chunk.blocks[iy + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] !== 0
            }

            const { position: resolvedPos, velocity: resolvedVel, isGrounded: newIsGrounded } =
              resolveBlockCollisions(physPos, physVel, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT, isBlockSolid)

            // Write resolved state back to physics body
            yield* physicsService.setPosition(playerBodyId, resolvedPos as Position).pipe(
              Effect.catchTag('PhysicsServiceError', () => Effect.void)
            )
            yield* physicsService.setVelocity(playerBodyId, resolvedVel).pipe(
              Effect.catchTag('PhysicsServiceError', () => Effect.void)
            )
            yield* Ref.set(isGroundedRef, newIsGrounded)

            // Sync resolved position to player state
            yield* playerService.updatePosition(playerId, resolvedPos as Position)
            yield* playerService.updateVelocity(playerId, resolvedVel)

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
          Ref.get(isGroundedRef),
      }
    })),
  }
) {}
export const GameStateServiceLive = GameStateService.Default
