import { useEffect, useRef, useState } from 'react'

import type { ManagedRuntime } from 'effect/ManagedRuntime'
import { Duration, Effect, Fiber, Option, Schedule, Schema, Stream, pipe } from 'effect'

import type { CameraHUDViewModel } from '@application/camera/hud-service'
import { CameraHUDService } from '@application/camera/hud-service'
import type { PlayerHUDViewModel } from '@application/player'
import { PlayerHUDService } from '@application/player'
import { InventoryReactiveSystemTag } from '@presentation/inventory/state/reactive-system'
import { InventoryStateStoreTag } from '@presentation/inventory/state/store'
import type { InventoryEventHandler, InventoryPanelModel } from '@presentation/inventory/adt'
import { InventoryOpened, parsePlayerId } from '@presentation/inventory/adt'
import { InventoryViewModelTag } from '@presentation/inventory/view-model'

import { InventoryService } from '@domain/inventory'
import { CameraFactory } from '@domain/camera/aggregate/camera/factory'
import { cameraToSnapshot } from '@domain/camera/cqrs/helpers'
import { CameraReadModel } from '@domain/camera/cqrs/read_model'
import { createPosition3D } from '@domain/camera/value_object/camera_position/operations'
import { CameraStateRepository } from '@domain/camera/repository/camera_state'
import { CameraIdSchema } from '@domain/camera/types'
import { PlayerDomainService } from '@domain/player/services'
import {
  PlayerGameModeSchema,
  PlayerNameSchema,
  PlayerPositionSchema,
  type PlayerId,
} from '@domain/player/types'
import { PlayerIdOperations } from '@domain/shared/entities/player_id'

type Runtime = ManagedRuntime<unknown, unknown>

const DEFAULT_PLAYER_ID = 'player_11111111-1111-1111-1111-111111111111'
const DEFAULT_CAMERA_ID = 'camera:primary'

const HUD_REFRESH_INTERVAL = Duration.millis(500)

interface HudState {
  readonly player: PlayerHUDViewModel | null
  readonly camera: CameraHUDViewModel | null
}

interface InventoryState {
  readonly panel: InventoryPanelModel | null
  readonly handler: InventoryEventHandler | null
}

export const useGameUI = (runtime: Runtime) => {
  const [hudState, setHudState] = useState<HudState>({ player: null, camera: null })
  const [inventoryPanel, setInventoryPanel] = useState<InventoryPanelModel | null>(null)
  const inventoryHandlerRef = useRef<InventoryEventHandler | null>(null)

  useEffect(() => {
    let cancelled = false

    const program = Effect.scoped(
      Effect.gen(function* () {
        const playerId: PlayerId = PlayerIdOperations.makeUnsafe(DEFAULT_PLAYER_ID)
        const inventoryPlayerId = yield* parsePlayerId(DEFAULT_PLAYER_ID)
        const cameraId = yield* Schema.decode(CameraIdSchema)(DEFAULT_CAMERA_ID)

        const playerDomain = yield* PlayerDomainService
        const playerName = yield* Schema.decode(PlayerNameSchema)('Player One')
        const gameMode = yield* Schema.decode(PlayerGameModeSchema)('survival')
        const playerPosition = yield* Schema.decode(PlayerPositionSchema)({
          x: 0,
          y: 64,
          z: 0,
          worldId: 'overworld',
          yaw: 0,
          pitch: 0,
        })

        yield* playerDomain
          .spawn({
            id: playerId,
            name: playerName,
            gameMode,
            position: playerPosition,
          })
          .pipe(Effect.catchAll(() => Effect.void))

        const playerSnapshot = yield* playerDomain.snapshot(playerId)

        const inventoryService = yield* InventoryService
        yield* inventoryService.createInventory(playerId).pipe(Effect.catchAll(() => Effect.void))

        const cameraRepository = yield* CameraStateRepository
        const cameraReadModel = yield* CameraReadModel

        const cameraExists = yield* cameraRepository.exists(cameraId)
        yield* Effect.when(!cameraExists, () =>
          Effect.gen(function* () {
            const position = playerSnapshot.aggregate.position
            const cameraBasePosition = yield* createPosition3D(position.x, position.y, position.z)
            const camera = yield* CameraFactory.createFirstPerson(cameraId, cameraBasePosition)
            yield* cameraRepository.save(camera)
            yield* cameraRepository.saveSnapshot(cameraId, cameraToSnapshot(camera))
            yield* cameraReadModel.upsert(camera)
          })
        )

        const inventoryViewModel = yield* InventoryViewModelTag
        const inventoryStateStore = yield* InventoryStateStoreTag
        const inventorySystem = yield* InventoryReactiveSystemTag

        yield* inventorySystem.register(inventoryPlayerId)
        yield* Effect.addFinalizer(() => inventorySystem.unregister(inventoryPlayerId).pipe(Effect.catchAll(() => Effect.void)))

        const inventoryHandler = yield* inventoryViewModel.handler(inventoryPlayerId)
        inventoryHandlerRef.current = inventoryHandler

        yield* inventorySystem.forceSync()
        yield* inventorySystem.start(500)

        yield* inventoryHandler(InventoryOpened({})).pipe(Effect.catchAll(() => Effect.void))

        const refreshPanel = (view: InventoryPanelModel) =>
          Effect.when(!cancelled, () => Effect.sync(() => setInventoryPanel(view)))

        const updatePanel = inventoryViewModel
          .panelModel(inventoryPlayerId)
          .pipe(
            Effect.flatMap(refreshPanel),
            Effect.catchAll((error) =>
              Effect.sync(() => {
                console.error('Inventory panel initialization error', error)
              })
            )
          )

        yield* updatePanel

        yield* inventoryStateStore
          .streamByPlayer(inventoryPlayerId)
          .pipe(
            Stream.runForEach((_) =>
              inventoryViewModel
                .panelModel(inventoryPlayerId)
                .pipe(
                  Effect.flatMap((panel) => refreshPanel(panel)),
                  Effect.catchAll((error) =>
                    Effect.sync(() => {
                      console.error('Inventory panel update error', error)
                    })
                  )
                )
            ),
            Effect.catchAll(() => Effect.void),
            Effect.forkScoped
          )

        const playerHUD = yield* PlayerHUDService
        const cameraHUD = yield* CameraHUDService

        const hudTick = Effect.gen(function* () {
          const player = yield* playerHUD.getViewModel(playerId)
          const camera = yield* cameraHUD.getStatus(cameraId)
          yield* Effect.when(!cancelled, () => Effect.sync(() => setHudState({ player, camera })))
        }).pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => {
              console.error('HUD update error', error)
            })
          )
        )

        yield* Stream.repeatEffect(hudTick)
          .pipe(Stream.schedule(Schedule.spaced(HUD_REFRESH_INTERVAL)), Stream.runDrain, Effect.forkScoped)

      })
    )

    const fiber = runtime.runFork(program)

    return () => {
      cancelled = true
      runtime.runFork(
        Fiber.interrupt(fiber).pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => {
              console.error('Failed to shutdown UI bridge', error)
            })
          )
        )
      )
    }
  }, [runtime])

  return {
    hud: hudState,
    inventory: {
      panel: inventoryPanel,
      handler: inventoryHandlerRef.current,
    } satisfies InventoryState,
    defaultCameraId: DEFAULT_CAMERA_ID,
    defaultPlayerId: DEFAULT_PLAYER_ID,
  }
}
