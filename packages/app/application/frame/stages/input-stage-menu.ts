import { Effect, Ref } from 'effect'
import { KeyMappings } from '@ts-minecraft/entity'
import { OPEN_MENU_KEY } from '@ts-minecraft/app/frame-handler.config'
import type { InputDeps, InputServices } from './input-stage-types'

export const handleEscape = (
  deps: InputDeps,
  services: Pick<InputServices, 'inputService' | 'inventoryRenderer' | 'settingsOverlay' | 'pauseMenu' | 'tradingPresentation' | 'soundManager'>,
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
      yield* services.soundManager.playEffect('inventoryClose')
      yield* Ref.set(deps.gamePausedRef, false)
    } else if (isSettingsOpen) {
      // Settings overlay close — pause-menu's own watchdog re-shows itself
      // afterward when it remains the active modal.
      yield* services.settingsOverlay.toggle()
      if (!isPauseMenuOpen) {
        yield* Ref.set(deps.gamePausedRef, false)
      }
    } else if (isPauseMenuOpen) {
      // Pause menu has its own keydown handler that consumes Esc to resume;
      // nothing more to do here.
    } else {
      // Vanilla behavior: Esc opens the in-session pause menu when gameplay
      // has focus and no other modal is active.
      yield* services.pauseMenu.openIfClosed()
      yield* Ref.set(deps.gamePausedRef, true)
    }
  })

export const handleMenuKey = (
  deps: InputDeps,
  services: Pick<InputServices, 'inputService' | 'inventoryRenderer' | 'settingsOverlay' | 'pauseMenu' | 'tradingPresentation'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const pressed = yield* services.inputService.consumeKeyPress(OPEN_MENU_KEY)
    if (!pressed) return
    // Only open the pause menu from clean gameplay — never on top of another modal
    // (inventory/trade/settings/pause), so the menu key can't stack overlays.
    const anyModalOpen =
      (yield* services.inventoryRenderer.isOpen()) ||
      (yield* services.tradingPresentation.isOpen()) ||
      (yield* services.settingsOverlay.isOpen()) ||
      (yield* services.pauseMenu.isOpen())
    if (anyModalOpen) return
    yield* services.pauseMenu.openIfClosed()
    yield* Ref.set(deps.gamePausedRef, true)
  })
