import { Effect, Ref, Option } from 'effect'
import { TRADE_DISTANCE, TRADE_OPEN_KEY, TRADE_NEXT_KEY, TRADE_PREV_KEY, TRADE_EXECUTE_KEY } from '@ts-minecraft/app/frame-handler.config'
import type { Position } from '@ts-minecraft/core'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import { hasAttackableTargetInCombatRange } from './interaction-stage-combat-targeting'
import type { InputDeps, InputServices } from './input-stage-types'

export const handleTradeKeys = (
  deps: InputDeps & Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<InputServices, 'inputService' | 'inventoryRenderer' | 'settingsOverlay' | 'tradingPresentation' | 'villageService'>,
  playerPos: Position,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const keyPressed = yield* services.inputService.consumeKeyPress(TRADE_OPEN_KEY)
    // Vanilla trade opening: right-click a villager. This stage runs BEFORE
    // the interaction stage, so the click is consumed ONLY when a villager is
    // actually under the crosshair in reach — otherwise block placement sees
    // it untouched. The T key stays as an accessibility fallback.
    let rightClickedVillager = false
    if (!keyPressed) {
      const tradeAlreadyOpen = yield* services.tradingPresentation.isOpen()
      if (!tradeAlreadyOpen) {
        const aimTarget = Option.getOrNull(
          yield* services.villageService.findNearestVillager(playerPos, TRADE_DISTANCE),
        )
        if (aimTarget !== null && hasAttackableTargetInCombatRange([aimTarget], deps.camera, null)) {
          rightClickedVillager = yield* services.inputService.consumeMouseClick(2)
        }
      }
    }
    const tradePressed = keyPressed || rightClickedVillager
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
