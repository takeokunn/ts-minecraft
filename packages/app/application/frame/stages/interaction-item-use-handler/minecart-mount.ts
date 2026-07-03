import { Effect, Option, Schema } from 'effect'
import { DEFAULT_PLAYER_ID, SlotIndex } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import { VEHICLE_SURFACE_SAMPLE_OFFSET } from '@ts-minecraft/game/application/game-state-update-orchestration'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

export type MinecartMountServices = Pick<
  FrameHandlerServices,
  'hotbarService' | 'inventoryService' | 'gameState' | 'blockService' | 'soundManager'
>

const MinecartItemSchema = Schema.Literal('MINECART')

// Right-click with a MINECART while standing on a rail mounts the minecart: the
// item is consumed and the player switches to the minecarting movement modality
// (boosted rail speed — see game-state-update-orchestration). Dismounting (sneak
// or leaving the rail) refunds the item there.
export const handleMinecartMount = (
  services: MinecartMountServices,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const selected = Option.getOrNull(yield* services.hotbarService.getSelectedBlockType())
    if (selected === null || !Schema.is(MinecartItemSchema)(selected)) return false

    const alreadyMinecarting = yield* services.gameState.isMinecarting()
    if (alreadyMinecarting) return false

    // Cross-modality exclusion: never stack boat + minecart speed multipliers.
    const alreadyBoating = yield* services.gameState.isBoating()
    if (alreadyBoating) return false

    const playerPos = yield* services.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (playerPos === null) return false

    // Sample the rail cell at the same mid-body offset the per-frame dismount
    // check uses (VEHICLE_SURFACE_SAMPLE_OFFSET); otherwise a fresh mount whose
    // floor(y) differs from floor(y − offset) self-dismounts on the next frame.
    const feetBlock = yield* services.blockService.getBlock({
      x: Math.floor(playerPos.x),
      y: Math.floor(playerPos.y - VEHICLE_SURFACE_SAMPLE_OFFSET),
      z: Math.floor(playerPos.z),
    }).pipe(Effect.catchAll(() => Effect.succeed(null)))
    if (feetBlock !== 'RAIL') return false

    // Consume the minecart BEFORE mounting — a failed removal must not mount.
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    const consumed = yield* services.inventoryService
      .removeBlock('MINECART', 1, SlotIndex.make(HOTBAR_START + SlotIndex.toNumber(selectedSlot)))
      .pipe(Effect.as(true), Effect.catchAll(() => Effect.succeed(false)))
    if (!consumed) return false

    yield* services.gameState.enterMinecart()
    yield* services.soundManager.playEffect('blockPlace', { position: playerPos }).pipe(Effect.catchAll(() => Effect.void))
    return true
  })
