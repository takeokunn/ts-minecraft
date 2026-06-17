import { Effect } from 'effect'
import type { FrameHandlerServices } from '@ts-minecraft/app/frame/types'

export const addExperienceWithMending = (
  amount: number,
  services: Pick<FrameHandlerServices, 'inventoryService' | 'equipmentService' | 'xpService'>,
) =>
  Effect.gen(function* () {
    const remainingAfterInventory = yield* services.inventoryService.repairMendingItemsWithXP(amount)
    const remainingAfterEquipment = yield* services.equipmentService.repairMendingItemsWithXP(remainingAfterInventory)
    if (remainingAfterEquipment <= 0) return yield* services.xpService.getXP()
    return yield* services.xpService.addXP(remainingAfterEquipment)
  })
