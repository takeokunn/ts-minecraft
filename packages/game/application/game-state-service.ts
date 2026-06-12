import { Effect, Ref, Clock, Option } from 'effect'
import { PlayerError } from '@ts-minecraft/entity/domain/errors'
import { PlayerService } from '@ts-minecraft/entity/application/player-service'
import { MovementService } from '@ts-minecraft/entity/application/movement-service'
import { PlayerInputService } from '@ts-minecraft/entity/application/player-input-service'
import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'
import { computeFlightVerticalVelocity, nextFlightState } from '@ts-minecraft/entity/domain/flight'
import { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state'
import { DeltaTimeSecs, PlayerId, Position, PhysicsBodyId, DEFAULT_PLAYER_ID, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { PhysicsService } from './physics-service'
import { ChunkManagerService } from '@ts-minecraft/world/application/chunk-manager-service'
import { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import { GameStateError } from '../domain/errors'
import { GameModeService } from './game-mode-service'
import { OFFSETS_3x3, isBlockSolid, isInWater } from '../domain/block-collision-predicates'
import { TimingState, INITIAL_TIMING_STATE } from './game-state.types'
import {
  computeFlightPosition,
  blendVelocityForInput,
  resolveCollisionOrNoclip,
  applySneakEdgeClamp,
} from './game-state-physics'

export type { TimingState }
export { TimingStateSchema } from './game-state.types'

export const PLAYER_BODY_ID = 'player'

const GRAVITY_Y = -9.82
const PLAYER_MASS = 70

const ZERO_VEC3 = Object.freeze({ x: 0, y: 0, z: 0 })

const SWIM_UP_SPEED = 3

const refreshChunkCache = (
  chunkManagerService: ChunkManagerService,
  playerCx: number,
  playerCz: number,
  chunkCacheRef: Ref.Ref<Array<{ blocks: Uint8Array } | null>>,
  lastChunkCoordRef: Ref.Ref<{ cx: number; cz: number }>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const cache = yield* Ref.get(chunkCacheRef)
    cache.fill(null)
    yield* Effect.forEach(
      OFFSETS_3x3,
      ([dx, dz]) =>
        Effect.gen(function* () {
          const chunk = yield* chunkManagerService.getChunk({ x: playerCx + dx, z: playerCz + dz })
          cache[(dx + 1) * 3 + (dz + 1)] = chunk
        }).pipe(Effect.ignore),
      { concurrency: 'unbounded', discard: true }
    )
    yield* Ref.set(lastChunkCoordRef, { cx: playerCx, cz: playerCz })
  })

const applyWaterDrag = (
  physicsService: PhysicsService,
  playerBodyId: PhysicsBodyId,
  resolvedVel: { x: number; y: number; z: number },
  swimUp: boolean,
): Effect.Effect<void, never> =>
  physicsService.setVelocity(playerBodyId, {
    x: resolvedVel.x * 0.4,
    y: swimUp ? SWIM_UP_SPEED : Math.max(resolvedVel.y * 0.4, -2),
    z: resolvedVel.z * 0.4,
  }).pipe(Effect.catchTag('PhysicsServiceError', () => Effect.void))

export class GameStateService extends Effect.Service<GameStateService>()(
  '@minecraft/application/GameStateService',
  {
    effect: Effect.gen(function* () {
      const playerService = yield* PlayerService
      const physicsService = yield* PhysicsService
      const movementService = yield* MovementService
      const cameraState = yield* PlayerCameraStateService
      const chunkManagerService = yield* ChunkManagerService
      const gameModeService = yield* GameModeService
      const inventoryService = yield* InventoryService
      const inputService = yield* PlayerInputService
      // deltaTime initial value uses a first-frame estimate of 16ms at 60fps
      const timingStateRef = yield* Ref.make<TimingState>(INITIAL_TIMING_STATE)
      // Opaque physics body ID for the player (replaces CANNON.Body ref)
      const playerBodyIdRef = yield* Ref.make<Option.Option<PhysicsBodyId>>(Option.none())
      // AABB-derived grounded state (updated each frame after block collision resolution)
      const isGroundedRef = yield* Ref.make(false)
      // Fixed-size 9-slot 3×3 chunk neighborhood cache. Indexed by
      // (dx + 1) * 3 + (dz + 1) where (dx, dz) ∈ [-1, 1]². `null` = not loaded.
      // Eliminates per-frame Map allocation, .clear(), and string key construction.
      const chunkCacheRef = yield* Ref.make<Array<{ blocks: Uint8Array } | null>>([null, null, null, null, null, null, null, null, null])
      // Last refreshed player chunk coord. Refresh the 9-cell cache only when this changes.
      const lastChunkCoordRef = yield* Ref.make<{ cx: number; cz: number }>({ cx: Number.NaN, cz: Number.NaN })
      // Creative-mode flight toggle state (false outside creative).
      const flyingRef = yield* Ref.make(false)

      const playerId = DEFAULT_PLAYER_ID

      return {
        initialize: (spawnPosition: Position): Effect.Effect<void, GameStateError> =>
          Effect.gen(function* () {
            yield* physicsService.initialize({
              gravity: { x: 0, y: GRAVITY_Y, z: 0 },
            })

            const playerBodyId = yield* physicsService.addBody({
              mass: PLAYER_MASS,
              position: spawnPosition,
              shape: 'box',
              shapeParams: {
                halfExtents: { x: PLAYER_HALF_WIDTH, y: PLAYER_HALF_HEIGHT, z: PLAYER_HALF_WIDTH },
              },
            })
            yield* Ref.set(playerBodyIdRef, Option.some(playerBodyId))
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
            const playerBodyId = Option.getOrNull(yield* Ref.get(playerBodyIdRef))
            if (playerBodyId === null) return yield* Effect.fail(new GameStateError({ operation: 'update', reason: 'Physics not initialized. Call initialize() first.' }))

            const rotation = yield* cameraState.getRotation()
            const isGrounded = yield* Ref.get(isGroundedRef)
            const isCreative = yield* gameModeService.isCreative()
            const isSpectator = yield* gameModeService.isSpectator()

            const flightToggled = yield* inputService.consumeKeyPress(KeyMappings.TOGGLE_FLIGHT)
            const flying = isSpectator || nextFlightState(yield* Ref.get(flyingRef), isCreative, flightToggled)
            yield* Ref.set(flyingRef, flying)

            let flightVy = 0
            if (flying) {
              const [ascend, descend] = yield* Effect.all([
                inputService.isKeyPressed(KeyMappings.JUMP),
                inputService.isKeyPressed(KeyMappings.SNEAK),
              ], { concurrency: 'unbounded' })
              flightVy = computeFlightVerticalVelocity(ascend, descend)
            }

            const sneaking = !flying && (yield* inputService.isKeyPressed(KeyMappings.SNEAK))

            /* c8 ignore next 3 */
            const currentVel = yield* physicsService.getVelocity(playerBodyId).pipe(
              Effect.catchTag('PhysicsServiceError', (e) =>
                Effect.gen(function* () {
                  yield* Effect.logWarning(`getVelocity fallback: ${e.message ?? String(e)}`)
                  return ZERO_VEC3
                })
              )
            )

            const inputVelocity = yield* movementService.update(rotation.yaw, isGrounded)
            const jumped = inputVelocity.y > 0

            yield* physicsService.setVelocity(playerBodyId,
              blendVelocityForInput(inputVelocity, currentVel, { flying, flightVy, jumped, isGrounded })
            )

            if (jumped) yield* Ref.set(isGroundedRef, false)

            const prePos: Position = (flying || (sneaking && isGrounded))
              ? yield* physicsService.getPosition(playerBodyId).pipe(
                  Effect.catchTag('PhysicsServiceError', () => Effect.succeed(ZERO_VEC3 as Position)),
                )
              : (ZERO_VEC3 as Position)

            yield* physicsService.step(deltaTime)

            /* c8 ignore next */
            const physPos = yield* physicsService.getPosition(playerBodyId).pipe(
              Effect.catchTag('PhysicsServiceError', () => Effect.succeed(ZERO_VEC3 as Position))
            )
            const physVel = yield* physicsService.getVelocity(playerBodyId).pipe(
              Effect.catchTag('PhysicsServiceError', () => Effect.succeed(ZERO_VEC3))
            )

            const effPos: Position = flying ? computeFlightPosition(physPos, prePos.y, flightVy, deltaTime) : physPos
            const effVel = flying ? { x: physVel.x, y: flightVy, z: physVel.z } : physVel

            const playerCx = Math.floor(effPos.x / CHUNK_SIZE)
            const playerCz = Math.floor(effPos.z / CHUNK_SIZE)
            const lastChunkCoord = yield* Ref.get(lastChunkCoordRef)
            if (lastChunkCoord.cx !== playerCx || lastChunkCoord.cz !== playerCz) {
              yield* refreshChunkCache(chunkManagerService, playerCx, playerCz, chunkCacheRef, lastChunkCoordRef)
            }
            const chunkCache = yield* Ref.get(chunkCacheRef)

            const isSolid = (wx: number, wy: number, wz: number): boolean =>
              isBlockSolid(wx, wy, wz, chunkCache, playerCx, playerCz)

            const { position: collidedPos, velocity: collidedVel, isGrounded: newIsGrounded } =
              resolveCollisionOrNoclip(effPos, effVel, isSolid, isSpectator)

            const { position: resolvedPos, velocity: resolvedVel } =
              applySneakEdgeClamp(prePos, collidedPos, collidedVel, isSolid, sneaking, isGrounded)

            yield* Effect.all([
              physicsService.setPosition(playerBodyId, resolvedPos).pipe(Effect.catchTag('PhysicsServiceError', () => Effect.void)),
              physicsService.setVelocity(playerBodyId, resolvedVel).pipe(Effect.catchTag('PhysicsServiceError', () => Effect.void)),
            ], { concurrency: 'unbounded', discard: true })
            yield* Ref.set(isGroundedRef, newIsGrounded)

            if (!isSpectator && isInWater(resolvedPos.x, resolvedPos.y, resolvedPos.z, chunkCache, playerCx, playerCz)) {
              const swimUp = !flying && (yield* inputService.isKeyPressed(KeyMappings.JUMP))
              yield* applyWaterDrag(physicsService, playerBodyId, resolvedVel, swimUp)
            }

            yield* Effect.all([
              playerService.updatePosition(playerId, resolvedPos),
              playerService.updateVelocity(playerId, resolvedVel),
            ], { concurrency: 'unbounded', discard: true })

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
            const playerBodyId = Option.getOrNull(yield* Ref.get(playerBodyIdRef))
            if (playerBodyId === null) return yield* Effect.fail(new GameStateError({ operation: 'respawn', reason: 'Physics not initialized. Call initialize() first.' }))

            // Mode-aware: in survival, clear inventory on death. Creative preserves inventory.
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
    }),
  }
) {}
export const GameStateServiceLive = GameStateService.Default
