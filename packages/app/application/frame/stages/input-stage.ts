// Stage 5: inputStage — mouse-look (when unpaused) + overlay/inventory/trade input.
// The orchestrator stays thin; handler logic lives in feature-specific helpers.
import { Effect, Ref } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps } from '@ts-minecraft/app/frame/types'
import type { Position } from '@ts-minecraft/core'
import { handleDropItemKey, handleInventoryKey } from './input-stage-inventory'
import { handleEscape, handleMenuKey } from './input-stage-menu'
import { handleHudToggle } from './input-stage-hud'
import { handleTradeKeys } from './input-stage-trade'
import { reconcileModalPause, syncDayLength } from './input-stage-runtime'
import type { InputDeps, InputServices, InputRefs } from './input-stage-types'

export const inputStage = (
  deps: Pick<FrameHandlerDeps, 'camera'> & InputDeps,
  services: Pick<InputServices, 'firstPersonCamera' | 'inputService' | 'inventoryRenderer' | 'settingsOverlay' | 'pauseMenu' | 'tradingPresentation' | 'hotbarService' | 'inventoryService' | 'villageService' | 'timeService' | 'soundManager'>,
  refs: InputRefs,
  inputs: {
    readonly mouseSensitivity: number
    readonly dayLengthSeconds: number
    readonly playerPos: Position
  },
): Effect.Effect<void, never> =>
  // Update camera rotation from mouse look (suppressed when a modal is open).
  // Sequential .pipe chain instead of Effect.all to avoid per-frame array + fiber allocation
  // (the handlers are synchronous reads/writes — zero parallelism benefit).
  Effect.flatMap(Ref.get(deps.gamePausedRef), (paused) =>
    Effect.flatMap(
      paused
        ? Effect.void
        : services.firstPersonCamera.update(deps.camera, inputs.mouseSensitivity),
      () =>
        logErrors(handleEscape(deps, services), 'Overlay error').pipe(
          Effect.flatMap(() => logErrors(handleMenuKey(deps, services), 'Overlay error')),
          Effect.flatMap(() => logErrors(handleHudToggle(services), 'Overlay error')),
          Effect.flatMap(() => logErrors(handleDropItemKey(services), 'Overlay error')),
          Effect.flatMap(() => logErrors(handleInventoryKey(deps, services), 'Overlay error')),
          Effect.flatMap(() => logErrors(handleTradeKeys(deps, services, inputs.playerPos), 'Overlay error')),
          Effect.flatMap(() => logErrors(syncDayLength(services, refs, inputs.dayLengthSeconds), 'Overlay error')),
          // Derive gamePausedRef from the live modal state AFTER all the handlers
          // (incl. the pause menu's own out-of-band open/close) have settled.
          Effect.flatMap(() => logErrors(reconcileModalPause(deps, services), 'Overlay error')),
        ),
    )
  )
