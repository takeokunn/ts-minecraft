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
import { resolveBlockCollisions, clampSneakEdge, SNEAK_STEP_DOWN } from '../domain/aabb-collision'
import { ChunkManagerService } from '@ts-minecraft/world/application/chunk-manager-service'
import { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import { GameStateError } from '../domain/errors'
import { GameModeService } from './game-mode-service'
import { OFFSETS_3x3, isBlockSolid, isInWater } from '../domain/block-collision-predicates'
import { TimingState, INITIAL_TIMING_STATE } from './game-state.types'

export type { TimingState }
export { TimingStateSchema } from './game-state.types'

export const PLAYER_BODY_ID = 'player'

const GRAVITY_Y = -9.82
const PLAYER_MASS = 70

const ZERO_VEC3 = Object.freeze({ x: 0, y: 0, z: 0 })

// Refresh the 9-cell 3×3 chunk neighborhood cache when the player's chunk coord changes.
// Saves 9 getChunk calls per frame when the player stays in the same chunk.
const refreshChunkCache = (
  chunkManagerService: ChunkManagerService,
  playerCx: number,
  playerCz: number,
  chunkCacheRef: Ref.Ref<Array<{ blocks: Uint8Array } | null>>,
  lastChunkCoordRef: Ref.Ref<{ cx: number; cz: number }>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const newCache: Array<{ blocks: Uint8Array } | null> = Array.from({ length: 9 }, () => null)
    yield* Effect.forEach(
      OFFSETS_3x3,
      ([dx, dz]) =>
        chunkManagerService.getChunk({ x: playerCx + dx, z: playerCz + dz }).pipe(
          Effect.match({
            onSuccess: (chunk) => { newCache[(dx + 1) * 3 + (dz + 1)] = chunk },
            onFailure: () => {},
          })
        ),
      { concurrency: 'unbounded', discard: true }
    )
    yield* Ref.set(chunkCacheRef, newCache)
    yield* Ref.set(lastChunkCoordRef, { cx: playerCx, cz: playerCz })
  })

// Upward velocity while holding JUMP underwater (FR-2 swim-up). Gentle, so the
// player rises steadily rather than launching out of the water.
const SWIM_UP_SPEED = 3

// Apply water drag: dampens velocity 60% and caps downward terminal velocity at
// -2 m/s. When `swimUp` (JUMP held underwater), replace the sinking Y with a
// steady upward swim instead.
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
    effect: Effect.suspend(() => Effect.all([
      PlayerService,
      PhysicsService,
      MovementService,
      PlayerCameraStateService,
      ChunkManagerService,
      GameModeService,
      InventoryService,
      PlayerInputService,
      // Timing state (deltaTime initial value uses a first-frame estimate of 16ms at 60fps)
      Ref.make<TimingState>(INITIAL_TIMING_STATE),
      // Opaque physics body ID for the player (replaces CANNON.Body ref)
      Ref.make<Option.Option<PhysicsBodyId>>(Option.none()),
      // AABB-derived grounded state (updated each frame after block collision resolution)
      Ref.make<boolean>(false),
      // Fixed-size 9-slot 3×3 chunk neighborhood cache. Indexed by
      // (dx + 1) * 3 + (dz + 1) where (dx, dz) ∈ [-1, 1]². `null` = not loaded.
      // Eliminates per-frame Map allocation, .clear(), and string key construction.
      Ref.make<Array<{ blocks: Uint8Array } | null>>([null, null, null, null, null, null, null, null, null]),
      // Last refreshed player chunk coord. Refresh the 9-cell cache only when this changes.
      Ref.make<{ cx: number; cz: number }>({ cx: Number.NaN, cz: Number.NaN }),
      // Creative-mode flight toggle state (false outside creative).
      Ref.make<boolean>(false),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([playerService, physicsService, movementService, cameraState, chunkManagerService, gameModeService, inventoryService, inputService, timingStateRef, playerBodyIdRef, isGroundedRef, chunkCacheRef, lastChunkCoordRef, flyingRef]) => {
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
            const playerBodyId = yield* Option.match(yield* Ref.get(playerBodyIdRef), {
              onNone: () => Effect.fail(new GameStateError({ operation: 'update', reason: 'Physics not initialized. Call initialize() first.' })),
              onSome: (id) => Effect.succeed(id),
            })

            const rotation = yield* cameraState.getRotation()
            const isGrounded = yield* Ref.get(isGroundedRef)

            // ─── Flight (FR-1 creative / R2 spectator) ────────────────────────
            // Creative: KeyF toggles flight. Spectator: ALWAYS flying (noclip
            // observer). While flying, held JUMP ascends and SNEAK descends,
            // gravity is bypassed, and horizontal movement gets full air control.
            const isCreative = yield* gameModeService.isCreative()
            const isSpectator = yield* gameModeService.isSpectator()
            const flightToggled = yield* inputService.consumeKeyPress(KeyMappings.TOGGLE_FLIGHT)
            const flying = isSpectator || nextFlightState(yield* Ref.get(flyingRef), isCreative, flightToggled)
            yield* Ref.set(flyingRef, flying)
            let flightVy = 0
            if (flying) {
              const ascend = yield* inputService.isKeyPressed(KeyMappings.JUMP)
              const descend = yield* inputService.isKeyPressed(KeyMappings.SNEAK)
              flightVy = computeFlightVerticalVelocity(ascend, descend)
            }

            // R7 sneak edge-protection: only relevant when walking on the ground.
            const sneaking = !flying && (yield* inputService.isKeyPressed(KeyMappings.SNEAK))

            /* c8 ignore next 3 */
            const currentVel = yield* physicsService.getVelocity(playerBodyId).pipe(
              Effect.catchTag('PhysicsServiceError', (e) =>
                Effect.logWarning(`getVelocity fallback: ${e.message ?? String(e)}`).pipe(
                  Effect.as(ZERO_VEC3)
                )
              )
            )

            const velocity = yield* movementService.update(rotation.yaw, isGrounded)
            const jumped = velocity.y > 0

            // Air control: only allow horizontal movement input when grounded.
            // Flight grants full horizontal air control and replaces the
            // gravity-driven Y with the controlled flight velocity.
            yield* physicsService.setVelocity(playerBodyId, {
              x: flying || isGrounded ? velocity.x : currentVel.x,
              y: flying ? flightVy : jumped ? velocity.y : currentVel.y,
              z: flying || isGrounded ? velocity.z : currentVel.z,
            })

            if (jumped) {
              yield* Ref.set(isGroundedRef, false)
            }

            // Capture pre-step position: flight needs prePos.y (gravity-free vertical
            // reconstruction) and sneak edge-protection needs prePos.x/z (to revert a
            // step that would walk off a ledge). One getPosition, only when needed.
            const prePos: Position = (flying || (sneaking && isGrounded))
              ? yield* physicsService.getPosition(playerBodyId).pipe(
                  Effect.catchTag('PhysicsServiceError', () => Effect.succeed(ZERO_VEC3 as Position)),
                )
              : (ZERO_VEC3 as Position)
            const prePosY = prePos.y

            yield* physicsService.step(deltaTime)

            /* c8 ignore next */
            const physPos = yield* physicsService.getPosition(playerBodyId).pipe(
              Effect.catchTag('PhysicsServiceError', () => Effect.succeed(ZERO_VEC3 as Position))
            )
            const physVel = yield* physicsService.getVelocity(playerBodyId).pipe(
              Effect.catchTag('PhysicsServiceError', () => Effect.succeed(ZERO_VEC3))
            )

            // Flight bypasses gravity: overwrite the step's gravity-affected Y with
            // the controlled flight motion BEFORE collision resolution, so flight
            // still clamps against solid blocks (no flying through terrain) while
            // hovering stays perfectly stable (no ½·g·dt² downward drift).
            const effPos: Position = flying ? ({ ...physPos, y: prePosY + flightVy * deltaTime } as Position) : physPos
            const effVel = flying ? { x: physVel.x, y: flightVy, z: physVel.z } : physVel

            // Refresh 3×3 chunk cache only when player chunk coord changes
            const playerCx = Math.floor(effPos.x / CHUNK_SIZE)
            const playerCz = Math.floor(effPos.z / CHUNK_SIZE)
            const lastChunkCoord = yield* Ref.get(lastChunkCoordRef)
            if (lastChunkCoord.cx !== playerCx || lastChunkCoord.cz !== playerCz) {
              yield* refreshChunkCache(chunkManagerService, playerCx, playerCz, chunkCacheRef, lastChunkCoordRef)
            }
            const chunkCache = yield* Ref.get(chunkCacheRef)

            // AABB block collision resolution — delegates solid-block test to block-collision-predicates.ts.
            // Spectator is noclip: skip collision entirely so the observer passes through terrain.
            const { position: collidedPos, velocity: collidedVel, isGrounded: newIsGrounded } = isSpectator
              ? { position: effPos, velocity: effVel, isGrounded: false }
              : resolveBlockCollisions(
                  effPos, effVel, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT,
                  (wx, wy, wz) => isBlockSolid(wx, wy, wz, chunkCache, playerCx, playerCz)
                )

            // R7 sneak edge-protection: while sneaking on the ground, revert any
            // per-axis step that would carry the player off an unsupported ledge.
            // Never traps on flat ground (support always exists there).
            const sneakClamp = sneaking && isGrounded
              ? clampSneakEdge(prePos, collidedPos, (x, z) => {
                  const feetY = collidedPos.y - PLAYER_HALF_HEIGHT
                  for (const cx of [x - PLAYER_HALF_WIDTH, x + PLAYER_HALF_WIDTH]) {
                    for (const cz of [z - PLAYER_HALF_WIDTH, z + PLAYER_HALF_WIDTH]) {
                      // Solid directly below the feet, or one block down (a step-down).
                      if (isBlockSolid(cx, feetY - 0.1, cz, chunkCache, playerCx, playerCz)
                        || isBlockSolid(cx, feetY - 0.1 - SNEAK_STEP_DOWN, cz, chunkCache, playerCx, playerCz)) {
                        return true
                      }
                    }
                  }
                  return false
                })
              : { x: collidedPos.x, z: collidedPos.z }
            const resolvedPos: Position = { ...collidedPos, x: sneakClamp.x, z: sneakClamp.z } as Position
            const resolvedVel = {
              x: sneakClamp.x !== collidedPos.x ? 0 : collidedVel.x,
              y: collidedVel.y,
              z: sneakClamp.z !== collidedPos.z ? 0 : collidedVel.z,
            }

            yield* physicsService.setPosition(playerBodyId, resolvedPos as Position).pipe(
              Effect.catchTag('PhysicsServiceError', () => Effect.void)
            )
            yield* physicsService.setVelocity(playerBodyId, resolvedVel).pipe(
              Effect.catchTag('PhysicsServiceError', () => Effect.void)
            )
            yield* Ref.set(isGroundedRef, newIsGrounded)

            // Apply water drag when player is inside a water block. Holding JUMP
            // (and not flying) swims upward (FR-2 swim-up). Spectator ignores water
            // (noclip observer flies freely through it).
            if (!isSpectator && isInWater(resolvedPos.x, resolvedPos.y, resolvedPos.z, chunkCache, playerCx, playerCz)) {
              const swimUp = !flying && (yield* inputService.isKeyPressed(KeyMappings.JUMP))
              yield* applyWaterDrag(physicsService, playerBodyId, resolvedVel, swimUp)
            }

            yield* playerService.updatePosition(playerId, resolvedPos as Position)
            yield* playerService.updateVelocity(playerId, resolvedVel)

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
    }))),
  }
) {}
export const GameStateServiceLive = GameStateService.Default
