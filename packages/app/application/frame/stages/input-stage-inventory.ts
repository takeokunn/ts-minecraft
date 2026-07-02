import * as THREE from 'three'
import { Effect, Option, Ref } from 'effect'
import { DROPPED_ITEM_PICKUP_DELAY_TICKS } from '@ts-minecraft/entity/domain/dropped-item'
import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import { SlotIndex, type Position } from '@ts-minecraft/core'
import type { InputDeps, InputServices } from './input-stage-types'

export const DROPPED_ITEM_THROW_FORWARD_OFFSET = 0.45
export const DROPPED_ITEM_THROW_VERTICAL_OFFSET = 0.75
export const DROPPED_ITEM_THROW_FORWARD_VELOCITY = 0.16
export const DROPPED_ITEM_THROW_UPWARD_VELOCITY = 0.08

type DropCamera = {
  readonly getWorldDirection: (target: THREE.Vector3) => THREE.Vector3
}

const scratchDropCameraDirection = new THREE.Vector3()

export const resolveDroppedItemThrow = (
  playerPosition: Position,
  camera: DropCamera,
): {
  readonly position: Position
  readonly velocity: Position
} => {
  camera.getWorldDirection(scratchDropCameraDirection)
  const horizontalLength = Math.hypot(
    scratchDropCameraDirection.x,
    scratchDropCameraDirection.z,
  )
  const forwardX =
    horizontalLength > 0.0001 ? scratchDropCameraDirection.x / horizontalLength : 0
  const forwardZ =
    horizontalLength > 0.0001 ? scratchDropCameraDirection.z / horizontalLength : -1

  return {
    position: {
      x: playerPosition.x + forwardX * DROPPED_ITEM_THROW_FORWARD_OFFSET,
      y: playerPosition.y + DROPPED_ITEM_THROW_VERTICAL_OFFSET,
      z: playerPosition.z + forwardZ * DROPPED_ITEM_THROW_FORWARD_OFFSET,
    },
    velocity: {
      x: forwardX * DROPPED_ITEM_THROW_FORWARD_VELOCITY,
      y: DROPPED_ITEM_THROW_UPWARD_VELOCITY,
      z: forwardZ * DROPPED_ITEM_THROW_FORWARD_VELOCITY,
    },
  }
}

export const handleDropItemKey = (
  services: Pick<InputServices, 'inputService' | 'inventoryRenderer' | 'playerListPanel' | 'settingsOverlay' | 'pauseMenu' | 'tradingPresentation' | 'hotbarService' | 'inventoryService' | 'droppedItemService'>,
  playerPosition: Position,
  camera: DropCamera,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const pressed = yield* services.inputService.consumeKeyPress(KeyMappings.DROP_ITEM)
    if (!pressed) return

    const anyModalOpen =
      (yield* services.inventoryRenderer.isOpen()) ||
      (yield* services.playerListPanel.isOpen()) ||
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

    const throwState = resolveDroppedItemThrow(playerPosition, camera)

    yield* services.droppedItemService.spawn({
      itemType: selectedItem,
      count: 1,
      position: throwState.position,
      velocity: throwState.velocity,
      pickupDelayTicks: DROPPED_ITEM_PICKUP_DELAY_TICKS,
    })
  })

export const handleInventoryKey = (
  deps: InputDeps,
  services: Pick<InputServices, 'inputService' | 'inventoryRenderer' | 'playerListPanel' | 'settingsOverlay' | 'tradingPresentation' | 'soundManager' | 'pauseMenu'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const inventoryPressed = yield* services.inputService.consumeKeyPress(KeyMappings.INVENTORY_OPEN)
    if (!inventoryPressed) return

    // Vanilla: the inventory key is inert while the game is paused — it must
    // never stack the inventory on top of the pause menu.
    if (yield* services.pauseMenu.isOpen()) return

    const isInvOpen = yield* services.inventoryRenderer.isOpen()
    if (isInvOpen) {
      const stillOpen = yield* services.inventoryRenderer.toggle()
      if (stillOpen) {
        yield* Ref.set(deps.gamePausedRef, true)
      } else {
        yield* services.soundManager.playEffect('inventoryClose')
        yield* Ref.set(deps.gamePausedRef, false)
      }
    } else {
      const isSettingsOpen = yield* services.settingsOverlay.isOpen()
      const tradeOpen = yield* services.tradingPresentation.isOpen()
      const isPlayerListOpen = yield* services.playerListPanel.isOpen()
      if (isSettingsOpen) yield* services.settingsOverlay.toggle()
      if (tradeOpen) yield* services.tradingPresentation.close()
      if (isPlayerListOpen) yield* services.playerListPanel.hide
      yield* services.inventoryRenderer.toggle()
      yield* services.soundManager.playEffect('inventoryOpen')
      yield* Ref.set(deps.gamePausedRef, true)
    }
  })

export const handleInventorySortKey = (
  services: Pick<InputServices, 'inputService' | 'inventoryRenderer'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const isInvOpen = yield* services.inventoryRenderer.isOpen()
    if (!isInvOpen) return

    const sortPressed = yield* services.inputService.consumeKeyPress(KeyMappings.INVENTORY_SORT)
    if (!sortPressed) return

    yield* services.inventoryRenderer.sortInventory()
  })
