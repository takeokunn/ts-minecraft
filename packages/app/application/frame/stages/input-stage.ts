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
  playerPos: Position,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const tradePressed = yield* services.inputService.consumeKeyPress(TRADE_OPEN_KEY)
    const tradeNextPressed = yield* services.inputService.consumeKeyPress(TRADE_NEXT_KEY)
    const tradePrevPressed = yield* services.inputService.consumeKeyPress(TRADE_PREV_KEY)
    const tradeExecutePressed = yield* services.inputService.consumeKeyPress(TRADE_EXECUTE_KEY)

    if (tradePressed) {
      const tradeOpen = yield* services.tradingPresentation.isOpen()
      if (tradeOpen) {
        yield* services.tradingPresentation.close()
        yield* Ref.set(deps.gamePausedRef, false)
      } else {
        const isInvOpen = yield* services.inventoryRenderer.isOpen()
        const isSettingsOpen = yield* services.settingsOverlay.isOpen()
        if (!isInvOpen && !isSettingsOpen) {
          const villagerOption = yield* services.villageService.findNearestVillager(playerPos, TRADE_DISTANCE)
          const villager = Option.getOrNull(villagerOption)
          if (villager !== null) {
            const opened = yield* services.tradingPresentation.open(villager.villagerId)
            if (opened) yield* Ref.set(deps.gamePausedRef, true)
          }
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

// Reconcile gamePausedRef to the ACTUAL modal state every frame. gamePausedRef is
// "is any modal open?" — it gates mouse-look (above), block interaction, and most
// importantly the canvas-click pointer-lock re-acquire (browser-runtime). The
// inventory/trade branches set it explicitly, but the pause menu was omitted AND it
// can open/close through paths inputStage never observes (its own document-level ESC
// handler, the Resume button click, the settings watchdog). Result: ESC opened the
// pause menu but left gamePausedRef=false, so the next canvas click re-grabbed the
// cursor — "ESCでフォーカスがはずれない". Deriving the flag from the live isOpen() of
// every modal makes it self-correcting regardless of which path opened or closed one.
const reconcileModalPause = (
  deps: InputDeps,
  services: Pick<InputServices, 'inventoryRenderer' | 'settingsOverlay' | 'pauseMenu' | 'tradingPresentation'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const invOpen = yield* services.inventoryRenderer.isOpen()
    const tradeOpen = yield* services.tradingPresentation.isOpen()
    const settingsOpen = yield* services.settingsOverlay.isOpen()
    const pauseOpen = yield* services.pauseMenu.isOpen()
    yield* Ref.set(deps.gamePausedRef, invOpen || tradeOpen || settingsOpen || pauseOpen)
  })

const syncDayLength = (
  services: Pick<InputServices, 'timeService'>,
  dayLengthSeconds: number,
): Effect.Effect<void, never> =>
  services.timeService.getDayLength().pipe(
    Effect.flatMap((currentDayLength) =>
      currentDayLength !== dayLengthSeconds
        ? services.timeService.setDayLength(dayLengthSeconds)
        : Effect.void,
    ),
  )

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
  // Update camera rotation from mouse look (suppressed when a modal is open).
  // Sequential .pipe chain instead of Effect.all to avoid per-frame array + fiber allocation
  // (the 4 handlers are synchronous reads/writes — zero parallelism benefit).
  Effect.flatMap(Ref.get(deps.gamePausedRef), (paused) =>
    Effect.flatMap(
      paused
        ? Effect.void
        : services.firstPersonCamera.update(deps.camera, inputs.mouseSensitivity),
      () =>
        logErrors(handleEscape(deps, services), 'Overlay error').pipe(
          Effect.flatMap(() => logErrors(handleInventoryKey(deps, services), 'Overlay error')),
          Effect.flatMap(() => logErrors(handleTradeKeys(deps, services, inputs.playerPos), 'Overlay error')),
          Effect.flatMap(() => logErrors(syncDayLength(services, inputs.dayLengthSeconds), 'Overlay error')),
          // Derive gamePausedRef from the live modal state AFTER all the handlers
          // (incl. the pause menu's own out-of-band open/close) have settled.
          Effect.flatMap(() => logErrors(reconcileModalPause(deps, services), 'Overlay error')),
        ),
    )
  )
