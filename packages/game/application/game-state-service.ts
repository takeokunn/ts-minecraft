import { Effect, Option, Ref } from 'effect'
import { PlayerError } from '@ts-minecraft/entity/domain/errors'
import { PlayerService } from '@ts-minecraft/entity/application/player-service'
import { MovementService } from '@ts-minecraft/entity/application/movement-service'
import { PlayerInputService } from '@ts-minecraft/entity/application/player-input-service'
import { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state'
import { DroppedItemService } from '@ts-minecraft/entity/application/dropped-item-service'
import { DeltaTimeSecs, PlayerId, Position, PhysicsBodyId, DEFAULT_PLAYER_ID, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT, type Vector3 } from '@ts-minecraft/core'
import { PhysicsService } from './physics-service'
import { ChunkManagerService } from '@ts-minecraft/world/application/chunk-manager-service'
import { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import { EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
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

const DEATH_DROP_PICKUP_DELAY_TICKS = 40
const DEATH_DROP_HEIGHT_OFFSET = 0.5
const DEATH_DROP_SCATTER_SPEED = 0.08
const DEATH_DROP_UPWARD_SPEED = 0.16
const DEATH_DROP_SPAWN_CONCURRENCY = 12

const deathDropPosition = (position: Position): Position => ({
  x: position.x,
  y: position.y + DEATH_DROP_HEIGHT_OFFSET,
  z: position.z,
})

const deathDropVelocity = (index: number): Position => {
  const angle = (index % 8) * (Math.PI / 4)
  const ring = Math.floor(index / 8)
  return {
    x: Math.cos(angle) * DEATH_DROP_SCATTER_SPEED,
    y: DEATH_DROP_UPWARD_SPEED + Math.min(ring, 2) * 0.02,
    z: Math.sin(angle) * DEATH_DROP_SCATTER_SPEED,
  }
}

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
      const equipmentService = yield* EquipmentService
      const droppedItemService = yield* DroppedItemService
      const inputService = yield* PlayerInputService
      const timingStateRef = yield* Ref.make<TimingState>(INITIAL_TIMING_STATE)
      const playerBodyIdRef = yield* Ref.make<Option.Option<PhysicsBodyId>>(Option.none())
      const isGroundedRef = yield* Ref.make(false)
      const chunkCacheRef = yield* Ref.make(createChunkCache())
      const lastChunkCoordRef = yield* Ref.make<{ cx: number; cz: number }>({ cx: Number.NaN, cz: Number.NaN })
      const flyingRef = yield* Ref.make(false)
      // Rideable boat as a movement modality: while true, water physics floats
      // the player at the surface with boosted speed (see the update branch).
      const boatingRef = yield* Ref.make(false)
      // Rideable minecart as a movement modality: while true and on a rail the
      // player's horizontal speed is boosted (see the update branch).
      const minecartingRef = yield* Ref.make(false)
      const poweredRailBoostRef = yield* Ref.make(false)

      const playerId = DEFAULT_PLAYER_ID

      return {
        initialize: (spawnPosition: Position): Effect.Effect<void, GameStateError> =>
          Effect.gen(function* () {
            // Re-entrant: GameState, PhysicsService and PlayerService are all
            // app-scoped singletons reused across worlds (quit-to-title -> start
            // another world). Clear every prior-session Ref and the player map
            // before establishing the new world, or the second world inherits
            // stale movement modalities (boating/flying) and player.create fails
            // "Player already exists", killing session init.
            yield* playerService.reset()
            yield* Ref.set(timingStateRef, INITIAL_TIMING_STATE)
            yield* Ref.set(isGroundedRef, false)
            yield* Ref.set(chunkCacheRef, createChunkCache())
            yield* Ref.set(lastChunkCoordRef, { cx: Number.NaN, cz: Number.NaN })
            yield* Ref.set(flyingRef, false)
            yield* Ref.set(boatingRef, false)
            yield* Ref.set(minecartingRef, false)
            yield* Ref.set(poweredRailBoostRef, false)

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
            boatingRef,
            minecartingRef,
            poweredRailBoostRef,
            inventoryService,
            playerId,
            deltaTime,
            waterHorizontalDrag,
          }),

        // Mount: called by the right-click handler after consuming the BOAT
        // item. Dismount happens inside the update loop (sneak or leaving
        // water) which refunds the item.
        enterBoat: (): Effect.Effect<void, never> => Ref.set(boatingRef, true),
        isBoating: (): Effect.Effect<boolean, never> => Ref.get(boatingRef),

        // Mount: called by the right-click handler after consuming the MINECART
        // item. Dismount happens inside the update loop (sneak or leaving the
        // rail) which refunds the item.
        enterMinecart: (): Effect.Effect<void, never> => Ref.set(minecartingRef, true),
        isMinecarting: (): Effect.Effect<boolean, never> => Ref.get(minecartingRef),
        // Written by the app layer each frame while minecarting: whether the
        // rail cell under the rider currently carries redstone power.
        setPoweredRailBoost: (active: boolean): Effect.Effect<void, never> => Ref.set(poweredRailBoostRef, active),

        respawn: (spawnPosition: Position): Effect.Effect<void, GameStateError> =>
          Effect.gen(function* () {
            const playerBodyId = Option.getOrNull(yield* Ref.get(playerBodyIdRef))
            if (playerBodyId === null) return yield* failMissingPhysicsBody('respawn')

            // Mode-aware: survival materializes inventory as world drops. Creative preserves inventory.
            const isSurvival = yield* gameModeService.isSurvival()
            if (isSurvival) {
              const deathPosition = yield* playerService.getPosition(playerId)
              const inventorySlots = yield* inventoryService.getAllSlots()
              const equipmentSlots = yield* equipmentService.getAll()
              const equipmentStacks = [
                equipmentSlots.HELMET,
                equipmentSlots.CHESTPLATE,
                equipmentSlots.LEGGINGS,
                equipmentSlots.BOOTS,
              ]
              const indexedDrops = [
                ...inventorySlots.map((slot, index) => ({ slot, index })),
                ...equipmentStacks.map((slot, index) => ({ slot, index: inventorySlots.length + index })),
              ]
              yield* Effect.forEach(indexedDrops, ({ slot, index }) =>
                Option.match(slot, {
                  onNone: () => Effect.void,
                  onSome: (stack) =>
                    droppedItemService.spawn({
                      itemType: stack.itemType,
                      count: stack.count,
                      position: deathDropPosition(deathPosition),
                      velocity: deathDropVelocity(index),
                      pickupDelayTicks: DEATH_DROP_PICKUP_DELAY_TICKS,
                    }).pipe(Effect.asVoid),
                }), { concurrency: DEATH_DROP_SPAWN_CONCURRENCY })
              yield* inventoryService.clear()
              yield* equipmentService.reset()
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

        applyPlayerVelocityImpulse: (impulse: Vector3): Effect.Effect<void, GameStateError> =>
          Effect.gen(function* () {
            const playerBodyId = Option.getOrNull(yield* Ref.get(playerBodyIdRef))
            if (playerBodyId === null) return yield* failMissingPhysicsBody('applyPlayerVelocityImpulse')

            const currentVelocity = yield* physicsService.getVelocity(playerBodyId)
            const nextVelocity = {
              x: currentVelocity.x + impulse.x,
              y: Math.max(currentVelocity.y, 0) + impulse.y,
              z: currentVelocity.z + impulse.z,
            }

            yield* physicsService.setVelocity(playerBodyId, nextVelocity)
            yield* playerService.updateVelocity(playerId, nextVelocity)
          }).pipe(
            Effect.catchTag('PhysicsServiceError', mapPhysicsServiceError('applyPlayerVelocityImpulse')),
            Effect.catchTag('PlayerError', mapPlayerError('applyPlayerVelocityImpulse'))
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
