import { useEffect, useRef, useState } from 'react'

import { Duration, Effect, Fiber, Option, Schedule, Stream } from 'effect'
import type { ManagedRuntime } from 'effect/ManagedRuntime'

import type { CameraHUDViewModel } from '@application/camera/hud-service'
import { CameraHUDService } from '@application/camera/hud-service'
import type { PlayerHUDViewModel } from '@application/player'
import { PlayerHUDService } from '@application/player'
import type { InventoryEventHandler, InventoryPanelModel } from '@presentation/inventory/adt'
import { InventoryOpened, parsePlayerId } from '@presentation/inventory/adt'
import { InventoryReactiveSystemTag } from '@presentation/inventory/state/reactive-system'
import { InventoryStateStoreTag } from '@presentation/inventory/state/store'
import { InventoryViewModelTag } from '@presentation/inventory/view-model'

import { PlayerCameraApplicationService } from '@application/camera'
import { InventoryManagerApplicationService } from '@application/inventory/inventory_manager'
import { PlayerLifecycleApplicationService } from '@application/player'

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
  const cameraIdRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const program = Effect.scoped(
      Effect.gen(function* () {
        const playerLifecycle = yield* PlayerLifecycleApplicationService
        const playerSnapshot = yield* playerLifecycle.ensurePlayerSession({
          id: DEFAULT_PLAYER_ID,
          name: 'Player One',
          gameMode: 'survival',
          position: {
            x: 0,
            y: 64,
            z: 0,
            worldId: 'overworld',
            yaw: 0,
            pitch: 0,
          },
        })

        const playerId = playerSnapshot.aggregate.id
        const inventoryPlayerId = yield* parsePlayerId(DEFAULT_PLAYER_ID)

        const inventoryManager = yield* InventoryManagerApplicationService
        yield* inventoryManager.initializePlayerInventory(playerId, 'player').pipe(Effect.catchAll(() => Effect.void))

        const playerCameraService = yield* PlayerCameraApplicationService
        const cameraPosition = yield* createPosition3D(
          playerSnapshot.aggregate.position.x,
          playerSnapshot.aggregate.position.y,
          playerSnapshot.aggregate.position.z
        ).pipe(Effect.orDie)
        const cameraId = yield* playerCameraService.initializePlayerCamera(
          playerSnapshot.aggregate.id,
          cameraPosition,
          Option.none()
        )
        cameraIdRef.current = String(cameraId)

        const inventoryViewModel = yield* InventoryViewModelTag
        const inventoryStateStore = yield* InventoryStateStoreTag
        const inventorySystem = yield* InventoryReactiveSystemTag

        yield* inventorySystem.register(inventoryPlayerId)
        yield* Effect.addFinalizer(() =>
          inventorySystem.unregister(inventoryPlayerId).pipe(Effect.catchAll(() => Effect.void))
        )

        const inventoryHandler = yield* inventoryViewModel.handler(inventoryPlayerId)
        inventoryHandlerRef.current = inventoryHandler

        yield* inventorySystem.forceSync()
        yield* inventorySystem.start(500)

        yield* inventoryHandler(InventoryOpened({})).pipe(Effect.catchAll(() => Effect.void))

        const refreshPanel = (view: InventoryPanelModel) =>
          Effect.when(!cancelled, () => Effect.sync(() => setInventoryPanel(view)))

        const updatePanel = inventoryViewModel.panelModel(inventoryPlayerId).pipe(
          Effect.flatMap(refreshPanel),
          Effect.catchAll((error) =>
            Effect.sync(() => {
              console.error('Inventory panel initialization error', error)
            })
          )
        )

        yield* updatePanel

        yield* inventoryStateStore.streamByPlayer(inventoryPlayerId).pipe(
          Stream.runForEach((_) =>
            inventoryViewModel.panelModel(inventoryPlayerId).pipe(
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

        yield* Stream.repeatEffect(hudTick).pipe(
          Stream.schedule(Schedule.spaced(HUD_REFRESH_INTERVAL)),
          Stream.runDrain,
          Effect.forkScoped
        )
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
    defaultCameraId: cameraIdRef.current ?? DEFAULT_CAMERA_ID,
    defaultPlayerId: DEFAULT_PLAYER_ID,
  }
}
