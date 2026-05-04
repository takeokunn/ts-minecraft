import { Effect, Ref, Schema, Clock, Data, Option } from 'effect'
import { PlayerService } from '@ts-minecraft/player'
import { PlayerError } from '@ts-minecraft/player'
import { DeltaTimeSecs, DeltaTimeSecsSchema, PlayerId, Position, PhysicsBodyId } from '@ts-minecraft/kernel'
import { PhysicsService } from '@ts-minecraft/physics'
import { MovementService } from '@ts-minecraft/player'
import { PlayerCameraStateService } from '@ts-minecraft/player'
import { DEFAULT_PLAYER_ID, FIRST_FRAME_DELTA_SECS, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT } from '@ts-minecraft/kernel'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { GameModeService } from './game-mode-service'
import { InventoryService } from '../../inventory/application/inventory-service'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/terrain'
import { resolveBlockCollisions } from '@ts-minecraft/physics'

// Hoisted to module scope: array allocated once, not per frame.
const OFFSETS_3x3 = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1], [ 0, 0], [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
] as const

export const TimingStateSchema = Schema.Struct({
  lastFrameTime: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  deltaTime: DeltaTimeSecsSchema,
  frameCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type TimingState = Schema.Schema.Type<typeof TimingStateSchema>

export class GameStateError extends Data.TaggedError('GameStateError')<{
  readonly operation: string
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    /* c8 ignore next */
    const causeMessage = this.cause instanceof Error ? this.cause.message : this.cause ? String(this.cause) : ''
    return `GameState error during ${this.operation}: ${this.reason}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

export const PLAYER_BODY_ID = 'player'

const GRAVITY_Y = -9.82
const PLAYER_MASS = 70

const ZERO_VEC3 = Object.freeze({ x: 0, y: 0, z: 0 })

export class GameStateService extends Effect.Service<GameStateService>()(
  '@minecraft/application/GameStateService',
  {
    effect: Effect.all([
      PlayerService,
      PhysicsService,
      MovementService,
      PlayerCameraStateService,
      ChunkManagerService,
      GameModeService,
      InventoryService,
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
      // Fixed-size 9-slot 3×3 chunk neighborhood cache. Indexed by
      // (dx + 1) * 3 + (dz + 1) where (dx, dz) ∈ [-1, 1]². `null` = not loaded.
      // Eliminates per-frame Map allocation, .clear(), and string key construction.
      Ref.make<Array<{ blocks: Uint8Array } | null>>([null, null, null, null, null, null, null, null, null]),
      // Last refreshed player chunk coord. -refresh the 9-cell cache only when this changes.
      Ref.make<{ cx: number; cz: number }>({ cx: Number.NaN, cz: Number.NaN }),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([playerService, physicsService, movementService, cameraState, chunkManagerService, gameModeService, inventoryService, timingStateRef, playerBodyIdRef, isGroundedRef, chunkCacheRef, lastChunkCoordRef]) => {
      const playerId = DEFAULT_PLAYER_ID

      return {
        initialize: (spawnPosition: Position): Effect.Effect<void, GameStateError> =>
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
            /* c8 ignore next 3 */
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
            /* c8 ignore next */
            const physPos = yield* physicsService.getPosition(playerBodyId).pipe(
              Effect.catchTag('PhysicsServiceError', () => Effect.succeed(ZERO_VEC3 as Position))
            )
            const physVel = yield* physicsService.getVelocity(playerBodyId).pipe(
              Effect.catchTag('PhysicsServiceError', () => Effect.succeed(ZERO_VEC3))
            )

            // Load surrounding chunks for block collision queries.
            // Refresh the 9-cell cache only when player's chunk coord changes —
            // saves 9 getChunk calls per frame when player stays in same chunk.
            const playerCx = Math.floor(physPos.x / CHUNK_SIZE)
            const playerCz = Math.floor(physPos.z / CHUNK_SIZE)
            const chunkCache = yield* Ref.get(chunkCacheRef)
            const lastChunkCoord = yield* Ref.get(lastChunkCoordRef)
            if (lastChunkCoord.cx !== playerCx || lastChunkCoord.cz !== playerCz) {
              yield* Effect.forEach(
                OFFSETS_3x3,
                ([dx, dz]) =>
                  chunkManagerService.getChunk({ x: playerCx + dx, z: playerCz + dz }).pipe(
                    Effect.match({
                      onSuccess: (chunk) => { chunkCache[(dx + 1) * 3 + (dz + 1)] = chunk },
                      onFailure: () => { chunkCache[(dx + 1) * 3 + (dz + 1)] = null },
                    })
                  ),
                { concurrency: 'unbounded', discard: true }
              )
              yield* Ref.set(lastChunkCoordRef, { cx: playerCx, cz: playerCz })
            }

            // AABB block collision resolution.
            // Inline coord/index math: avoid worldToBlockIndex's `${cx},${cz}` string
            // and Map.get — we know cx/cz are within ±1 of playerCx/playerCz, so
            // direct array lookup at (dx + 1) * 3 + (dz + 1).
            const isBlockSolid = (wx: number, wy: number, wz: number): boolean => {
              const ly = Math.floor(wy)
              if (ly < 0) return true  // bedrock floor
              /* c8 ignore next */
              if (ly >= CHUNK_HEIGHT) return false
              const bx = Math.floor(wx)
              const bz = Math.floor(wz)
              const cx = Math.floor(bx / CHUNK_SIZE)
              const cz = Math.floor(bz / CHUNK_SIZE)
              const dx = cx - playerCx
              const dz = cz - playerCz
              /* c8 ignore next */
              if (dx < -1 || dx > 1 || dz < -1 || dz > 1) return false
              const chunk = chunkCache[(dx + 1) * 3 + (dz + 1)]
              if (chunk == null) return false
              const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
              const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
              return chunk.blocks[chunkBlockIndexUnchecked(lx, ly, lz)] !== 0
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
              /* c8 ignore next -- defensive re-raise: only fires if physics service faults */
              Effect.fail(new GameStateError({ operation: 'update', reason: e.operation, cause: e }))
            ),
            Effect.catchTag('PlayerError', (e) =>
              /* c8 ignore next -- defensive re-raise: only fires if player service faults */
              Effect.fail(new GameStateError({ operation: 'update', reason: e.reason, cause: e }))
            )
          ),

        respawn: (spawnPosition: Position): Effect.Effect<void, GameStateError> =>
          Effect.gen(function* () {
            const playerBodyId = yield* Option.match(yield* Ref.get(playerBodyIdRef), {
              onNone: () => Effect.fail(new GameStateError({ operation: 'respawn', reason: 'Physics not initialized. Call initialize() first.' })),
              onSome: (id) => Effect.succeed(id),
            })

            // Mode-aware inventory handling (FR-1.3): in survival, the player
            // drops everything on death (Phase 1: clear; Phase 3 will add
            // world-entity drops at deathPos). Creative preserves the inventory.
            const isSurvival = yield* gameModeService.isSurvival()
            if (isSurvival) {
              yield* inventoryService.clear()
            }

            yield* physicsService.setPosition(playerBodyId, spawnPosition)
            yield* physicsService.setVelocity(playerBodyId, ZERO_VEC3)
            yield* playerService.updatePosition(playerId, spawnPosition)
            yield* playerService.updateVelocity(playerId, ZERO_VEC3)
            yield* Ref.set(isGroundedRef, false)
            // Invalidate the 3×3 chunk cache so it refreshes on next update()
            yield* Ref.set(lastChunkCoordRef, { cx: Number.NaN, cz: Number.NaN })
          }).pipe(
            Effect.catchTag('PhysicsServiceError', (e) =>
              /* c8 ignore next -- defensive re-raise: only fires if physics service faults */
              Effect.fail(new GameStateError({ operation: 'respawn', reason: e.operation, cause: e }))
            ),
            Effect.catchTag('PlayerError', (e) =>
              /* c8 ignore next -- defensive re-raise: only fires if player service faults */
              Effect.fail(new GameStateError({ operation: 'respawn', reason: e.reason, cause: e }))
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
