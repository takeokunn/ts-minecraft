import { Effect, Option } from 'effect'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import { ItemStack, maxStackFor } from '@ts-minecraft/inventory/domain/item-stack'
import { SlotIndex } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import type { FrameCreativePickInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/creative-pick'
import type { TargetBlockHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import { readBlockTypeAt } from '@ts-minecraft/app/frame/stages/interaction-block-access'

const getTargetBlockType = (
  services: FrameCreativePickInteractionServices,
  targetBlock: Option.Option<TargetBlockHit>,
): Effect.Effect<BlockType | null, never> =>
  Effect.gen(function* () {
    const tb = Option.getOrNull(targetBlock)
    if (tb === null) return null

    const blockType = yield* readBlockTypeAt(services.chunkManagerService, tb).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    return blockType === 'AIR' ? null : blockType
  })

export const handleCreativePickBlock = (
  services: FrameCreativePickInteractionServices,
  targetBlock: Option.Option<TargetBlockHit>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const creative = yield* services.gameMode.isCreative()
    if (!creative) return

    const blockType = yield* getTargetBlockType(services, targetBlock)
    if (blockType === null) return

    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    yield* services.inventoryService.setSlot(
      SlotIndex.make(HOTBAR_START + selectedSlot),
      Option.some(new ItemStack({ itemType: blockType, count: maxStackFor(blockType), durability: null })),
    )
  })
