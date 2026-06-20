import { Effect, Option, Ref } from 'effect'
import { DROPPED_ITEM_PICKUP_DELAY_TICKS } from '@ts-minecraft/entity/domain/dropped-item'
import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import { SlotIndex, type Position } from '@ts-minecraft/core'
import type { InputDeps, InputServices } from './input-stage-types'

export const handleDropItemKey = (
  services: Pick<InputServices, 'inputService' | 'inventoryRenderer' | 'settingsOverlay' | 'pauseMenu' | 'tradingPresentation' | 'hotbarService' | 'inventoryService' | 'droppedItemService'>,
  playerPosition: Position,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const pressed = yield* services.inputService.consumeKeyPress(KeyMappings.DROP_ITEM)
    if (!pressed) return

    const anyModalOpen =
      (yield* services.inventoryRenderer.isOpen()) ||
      (yield* services.tradingPresentation.isOpen()) ||
      (yield* services.settingsOverlay.isOpen()) ||
      (yield* services.pauseMenu.isOpen())
    if (anyModalOpen) return

    const selectedItemOption = yield* services.hotbarService.getSelectedBlockType()
    const selectedItem = Option.getOrNull(selectedItemOption)
    if (selectedItem === null) return

    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    const inventorySlot = SlotIndex.make(HOTBAR_START + SlotIndex.toNumber(selectedSlot))
    const removed = yield* services.inventoryService.removeBlock(selectedItem, 1, inventorySlot).pipe(
      Effect.as(true),
      Effect.catchAll(() => Effect.succeed(false)),
    )
    if (!removed) return

    yield* services.droppedItemService.spawn({
      itemType: selectedItem,
      count: 1,
      position: playerPosition,
      pickupDelayTicks: DROPPED_ITEM_PICKUP_DELAY_TICKS,
    })
  })

export const handleInventoryKey = (
  deps: InputDeps,
  services: Pick<InputServices, 'inputService' | 'inventoryRenderer' | 'settingsOverlay' | 'tradingPresentation' | 'soundManager'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const inventoryPressed = yield* services.inputService.consumeKeyPress(KeyMappings.INVENTORY_OPEN)
    if (!inventoryPressed) return

    const isInvOpen = yield* services.inventoryRenderer.isOpen()
    if (isInvOpen) {
      yield* services.inventoryRenderer.toggle()
      yield* services.soundManager.playEffect('inventoryClose')
      yield* Ref.set(deps.gamePausedRef, false)
    } else {
      const isSettingsOpen = yield* services.settingsOverlay.isOpen()
      const tradeOpen = yield* services.tradingPresentation.isOpen()
      if (isSettingsOpen) yield* services.settingsOverlay.toggle()
      if (tradeOpen) yield* services.tradingPresentation.close()
      yield* services.inventoryRenderer.toggle()
      yield* services.soundManager.playEffect('inventoryOpen')
      yield* Ref.set(deps.gamePausedRef, true)
    }
  })
