import { Effect, Option, Ref } from 'effect'
import { PlayerError } from '@ts-minecraft/entity/domain/errors'
import { PlayerService } from '@ts-minecraft/entity/application/player-service'
import { MovementService } from '@ts-minecraft/entity/application/movement-service'
import { PlayerInputService } from '@ts-minecraft/entity/application/player-input-service'
import { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state'
import { DeltaTimeSecs, PlayerId, Position, PhysicsBodyId, DEFAULT_PLAYER_ID, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT } from '@ts-minecraft/core'
import { PhysicsService } from './physics-service'
import { ChunkManagerService } from '@ts-minecraft/world/application/chunk-manager-service'
import { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import { GameStateError } from '../domain/errors'
import { GameModeService } from './game-mode-service'
import { TimingState, INITIAL_TIMING_STATE } from './game-state.types'
import {
  GRAVITY_Y,
  PLAYER_MASS,
  createChunkCache,
} from './game-state-support'
import { failMissingPhysicsBody, mapPhysicsServiceError, mapPlayerError } from './game-state-errors'
import { syncPlayerTransformAndResetState } from './game-state-player-sync'
import { runGameStateUpdate } from './game-state-update-orchestration'

export type { TimingState }
export { TimingStateSchema } from './game-state.types'

export const PLAYER_BODY_ID = 'player'

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
      const chunkCacheRef = yield* Ref.make(createChunkCache())
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
            Effect.catchTag('PhysicsServiceError', mapPhysicsServiceError('initialize')),
            Effect.catchTag('PlayerError', mapPlayerError('initialize'))
          ),

        update: (deltaTime: DeltaTimeSecs, waterHorizontalDrag?: number | undefined): Effect.Effect<void, GameStateError> =>
          runGameStateUpdate({
            playerService,
            physicsService,
            movementService,
            cameraState,
            chunkManagerService,
            gameModeService,
            inputService,
            timingStateRef,
            playerBodyIdRef,
            isGroundedRef,
            chunkCacheRef,
            lastChunkCoordRef,
            flyingRef,
            playerId,
            deltaTime,
            waterHorizontalDrag,
          }),

        respawn: (spawnPosition: Position): Effect.Effect<void, GameStateError> =>
          Effect.gen(function* () {
            const playerBodyId = Option.getOrNull(yield* Ref.get(playerBodyIdRef))
            if (playerBodyId === null) return yield* failMissingPhysicsBody('respawn')

            // Mode-aware: in survival, clear inventory on death. Creative preserves inventory.
            const isSurvival = yield* gameModeService.isSurvival()
            if (isSurvival) {
              yield* inventoryService.clear()
            }

            yield* syncPlayerTransformAndResetState(
              physicsService,
              playerService,
              playerId,
              playerBodyId,
              spawnPosition,
              isGroundedRef,
              lastChunkCoordRef,
            )
          }).pipe(
            Effect.catchTag('PhysicsServiceError', mapPhysicsServiceError('respawn')),
            Effect.catchTag('PlayerError', mapPlayerError('respawn'))
          ),

        setPlayerPosition: (position: Position): Effect.Effect<void, GameStateError> =>
          Effect.gen(function* () {
            const playerBodyId = Option.getOrNull(yield* Ref.get(playerBodyIdRef))
            if (playerBodyId === null) return yield* failMissingPhysicsBody('setPlayerPosition')

            yield* syncPlayerTransformAndResetState(
              physicsService,
              playerService,
              playerId,
              playerBodyId,
              position,
              isGroundedRef,
              lastChunkCoordRef,
            )
          }).pipe(
            Effect.catchTag('PhysicsServiceError', mapPhysicsServiceError('setPlayerPosition')),
            Effect.catchTag('PlayerError', mapPlayerError('setPlayerPosition'))
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
