import { Effect } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { RedstoneComponentType, type RedstoneComponent } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

export type RedstoneHopperWorldServices = Pick<
  FrameHandlerServices,
  'blockService' | 'chestService' | 'droppedItemService'
>

// Vanilla hoppers keep an internal buffer; this model transfers directly:
// dropped items resting in/around the hopper cell go into the CHEST directly
// below. Without a chest below the hopper leaves drops untouched — items are
// never destroyed. Anything the chest can't fit is re-spawned in place.
export const applyHopperWorldEffects = (
  services: RedstoneHopperWorldServices,
  components: ReadonlyArray<RedstoneComponent>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    for (const component of components) {
      if (component.type !== RedstoneComponentType.Hopper) continue

      const below: Position = {
        x: Math.floor(component.position.x),
        y: Math.floor(component.position.y) - 1,
        z: Math.floor(component.position.z),
      }
      const belowBlock = yield* services.blockService.getBlock(below).pipe(
        Effect.catchAll(() => Effect.succeed(null)),
      )
      if (belowBlock !== 'CHEST') continue

      const hopperCenter = {
        x: Math.floor(component.position.x) + 0.5,
        y: Math.floor(component.position.y) + 0.5,
        z: Math.floor(component.position.z) + 0.5,
      }
      const collected = yield* services.droppedItemService.collectWithin(hopperCenter)

      for (const item of collected) {
        const deposited = yield* services.chestService.depositIntoChestAt(below, item.itemType, item.count)
        const remainder = item.count - deposited
        if (remainder > 0) {
          // Chest full: put the overflow back where it was so nothing is lost.
          yield* services.droppedItemService.spawn({
            itemType: item.itemType,
            count: remainder,
            position: item.position,
          }).pipe(Effect.asVoid)
        }
      }
    }
  })
