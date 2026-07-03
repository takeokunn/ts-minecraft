import { Effect, Option, Schema } from 'effect'
import { DEFAULT_PLAYER_ID, SlotIndex } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

export type BoatMountServices = Pick<
  FrameHandlerServices,
  'hotbarService' | 'inventoryService' | 'gameState' | 'blockService' | 'soundManager'
>

const BoatItemSchema = Schema.Literal('BOAT')

// Right-click with a BOAT while standing in water mounts the boat: the item
// is consumed and the player switches to the boating movement modality
// (surface float + boat speed — see game-state-update-orchestration).
// Dismounting (sneak or reaching land) refunds the item there.
export const handleBoatMount = (
  services: BoatMountServices,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const selected = Option.getOrNull(yield* services.hotbarService.getSelectedBlockType())
    if (selected === null || !Schema.is(BoatItemSchema)(selected)) return false

    const alreadyBoating = yield* services.gameState.isBoating()
    if (alreadyBoating) return false

    const playerPos = yield* services.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (playerPos === null) return false

    const feetBlock = yield* services.blockService.getBlock({
      x: Math.floor(playerPos.x),
      y: Math.floor(playerPos.y),
      z: Math.floor(playerPos.z),
    }).pipe(Effect.catchAll(() => Effect.succeed(null)))
    if (feetBlock !== 'WATER') return false

    // Consume the boat BEFORE mounting — a failed removal must not mount.
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    const consumed = yield* services.inventoryService
      .removeBlock('BOAT', 1, SlotIndex.make(HOTBAR_START + SlotIndex.toNumber(selectedSlot)))
      .pipe(Effect.as(true), Effect.catchAll(() => Effect.succeed(false)))
    if (!consumed) return false

    yield* services.gameState.enterBoat()
    yield* services.soundManager.playEffect('blockPlace', { position: playerPos }).pipe(Effect.catchAll(() => Effect.void))
    return true
  })
