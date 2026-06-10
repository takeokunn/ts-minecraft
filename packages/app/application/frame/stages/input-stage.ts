// Stage 5: inputStage — mouse-look (when unpaused) + overlay/inventory/trade input.
// Decomposed into 4 helpers so the orchestrator stays at CC≈6:
//   - handleEscape       — Esc-driven modal closing / pause-menu open
//   - handleInventoryKey — E key inventory toggle
//   - handleTradeKeys    — T key trade open/close + nav keys (also routes nav
//                          keys to inventory crafting when inventory is open)
//   - syncDayLength      — write-through of settings.dayLengthSeconds
import { Effect, Option, Ref } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices } from '@ts-minecraft/app/frame/types'
import { KeyMappings } from '@ts-minecraft/entity'
import {
  TRADE_DISTANCE,
  TRADE_OPEN_KEY,
  TRADE_NEXT_KEY,
  TRADE_PREV_KEY,
  TRADE_EXECUTE_KEY,
} from '@ts-minecraft/app/frame-handler.config'
import type { Position } from '@ts-minecraft/core'

type InputDeps = Pick<FrameHandlerDeps, 'gamePausedRef'>
type InputServices = Pick<
  FrameHandlerServices,
  | 'inputService'
  | 'inventoryRenderer'
  | 'settingsOverlay'
  | 'pauseMenu'
  | 'tradingPresentation'
  | 'villageService'
  | 'timeService'
>

const handleEscape = (
  deps: InputDeps,
  services: Pick<InputServices, 'inputService' | 'inventoryRenderer' | 'settingsOverlay' | 'pauseMenu' | 'tradingPresentation'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const escPressed = yield* services.inputService.consumeKeyPress(KeyMappings.ESCAPE)
    if (!escPressed) return

    const isTradeOpen = yield* services.tradingPresentation.isOpen()
    const isInvOpen = yield* services.inventoryRenderer.isOpen()
    const isSettingsOpen = yield* services.settingsOverlay.isOpen()
    const isPauseMenuOpen = yield* services.pauseMenu.isOpen()

    if (isTradeOpen) {
      yield* services.tradingPresentation.close()
      yield* Ref.set(deps.gamePausedRef, false)
    } else if (isInvOpen) {
      yield* services.inventoryRenderer.toggle()
      yield* Ref.set(deps.gamePausedRef, false)
    } else if (isSettingsOpen) {
      // Settings overlay close — pause-menu's own watchdog re-shows itself
      // afterward when it remains the active modal.
      yield* services.settingsOverlay.toggle()
      if (!isPauseMenuOpen) {
        yield* Ref.set(deps.gamePausedRef, false)
      }
    } else if (isPauseMenuOpen) {
      // Pause menu has its own keydown handler that consumes Esc to
      // resume; nothing more to do here.
    } else {
      // FR-1.4: ESC during play opens the in-session pause menu (formerly
      // toggled the settings overlay; settings is now reachable via the
      // pause menu's "Settings" button).
      yield* services.pauseMenu.openIfClosed()
    }
  })

const handleInventoryKey = (
  deps: InputDeps,
  services: Pick<InputServices, 'inputService' | 'inventoryRenderer' | 'settingsOverlay' | 'tradingPresentation'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const inventoryPressed = yield* services.inputService.consumeKeyPress(KeyMappings.INVENTORY_OPEN)
    if (!inventoryPressed) return

    const isInvOpen = yield* services.inventoryRenderer.isOpen()
    if (isInvOpen) {
      yield* services.inventoryRenderer.toggle()
      yield* Ref.set(deps.gamePausedRef, false)
    } else {
      const isSettingsOpen = yield* services.settingsOverlay.isOpen()
      const tradeOpen = yield* services.tradingPresentation.isOpen()
      if (isSettingsOpen) yield* services.settingsOverlay.toggle()
      if (tradeOpen) yield* services.tradingPresentation.close()
      yield* services.inventoryRenderer.toggle()
      yield* Ref.set(deps.gamePausedRef, true)
    }
  })

const handleTradeKeys = (
  deps: InputDeps,
  services: Pick<InputServices, 'inputService' | 'inventoryRenderer' | 'settingsOverlay' | 'tradingPresentation' | 'villageService'>,
  inputs: { readonly playerPos: Position },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const [tradePressed, tradeNextPressed, tradePrevPressed, tradeExecutePressed] = yield* Effect.all(
      [
        services.inputService.consumeKeyPress(TRADE_OPEN_KEY),
        services.inputService.consumeKeyPress(TRADE_NEXT_KEY),
        services.inputService.consumeKeyPress(TRADE_PREV_KEY),
        services.inputService.consumeKeyPress(TRADE_EXECUTE_KEY),
      ],
      // Sequential: consumeKeyPress is a synchronous edge read; unbounded
      // concurrency spawns fibers every frame for no gain.
    )

    if (tradePressed) {
      const tradeOpen = yield* services.tradingPresentation.isOpen()
      if (tradeOpen) {
        yield* services.tradingPresentation.close()
        yield* Ref.set(deps.gamePausedRef, false)
      } else {
        const isInvOpen = yield* services.inventoryRenderer.isOpen()
        const isSettingsOpen = yield* services.settingsOverlay.isOpen()
        if (!isInvOpen && !isSettingsOpen) {
          const villagerOption = yield* services.villageService.findNearestVillager(inputs.playerPos, TRADE_DISTANCE)
          yield* Option.match(villagerOption, {
            onNone: () => Effect.void,
            onSome: (villager) =>
              services.tradingPresentation.open(villager.villagerId).pipe(
                Effect.flatMap((opened) => (opened ? Ref.set(deps.gamePausedRef, true) : Effect.void)),
              ),
          })
        }
      }
    }

    // FR-007: Early-exit guard — when no overlay is open (gamePausedRef=false),
    // skip trading navigation/refresh and inventory update entirely.
    const anyOverlayOpen = yield* Ref.get(deps.gamePausedRef)

    if (anyOverlayOpen) {
      const tradeOpenAfterToggles = yield* services.tradingPresentation.isOpen()

      if (tradeOpenAfterToggles) {
        if (tradePrevPressed) {
          yield* services.tradingPresentation.cycleSelection(-1)
        }
        if (tradeNextPressed) {
          yield* services.tradingPresentation.cycleSelection(1)
        }
        if (tradeExecutePressed) {
          yield* services.tradingPresentation.executeSelectedTrade()
        }
        yield* services.tradingPresentation.refresh()
      } else {
        const inventoryOpenAfterToggles = yield* services.inventoryRenderer.isOpen()
        if (inventoryOpenAfterToggles) {
          if (tradePrevPressed) {
            yield* services.inventoryRenderer.cycleRecipes(-1)
          }
          if (tradeNextPressed) {
            yield* services.inventoryRenderer.cycleRecipes(1)
          }
          if (tradeExecutePressed) {
            yield* services.inventoryRenderer.craftSelectedRecipe()
          }
        }
      }

      yield* services.inventoryRenderer.update()
    }
  })

const syncDayLength = (
  services: Pick<InputServices, 'timeService'>,
  inputs: { readonly dayLengthSeconds: number },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // Sync day length to TimeService in case user applied settings changes
    // Guard: only update if the value has actually changed (avoids 60 allocs/sec)
    const currentDayLength = yield* services.timeService.getDayLength()
    if (currentDayLength !== inputs.dayLengthSeconds) {
      yield* services.timeService.setDayLength(inputs.dayLengthSeconds)
    }
  })

export const inputStage = (
  deps: Pick<FrameHandlerDeps, 'camera' | 'gamePausedRef'>,
  services: Pick<
    FrameHandlerServices,
    | 'firstPersonCamera'
    | 'inputService'
    | 'inventoryRenderer'
    | 'settingsOverlay'
    | 'pauseMenu'
    | 'tradingPresentation'
    | 'villageService'
    | 'timeService'
  >,
  inputs: {
    readonly mouseSensitivity: number
    readonly dayLengthSeconds: number
    readonly playerPos: Position
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // Update camera rotation from mouse look (suppressed when a modal is open)
    yield* Ref.get(deps.gamePausedRef).pipe(
      Effect.flatMap((paused) =>
        paused ? Effect.void : services.firstPersonCamera.update(deps.camera, inputs.mouseSensitivity),
      ),
    )

    yield* logErrors(
      Effect.all(
        [
          handleEscape(deps, services),
          handleInventoryKey(deps, services),
          handleTradeKeys(deps, services, { playerPos: inputs.playerPos }),
          syncDayLength(services, { dayLengthSeconds: inputs.dayLengthSeconds }),
        ],
        { discard: true },
      ),
      'Overlay error',
    )
  })
