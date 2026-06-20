import { Effect } from 'effect'

export type MendingExperienceServices = {
  readonly inventoryService: {
    readonly repairMendingItemsWithXP: (amount: number) => Effect.Effect<number, never, never>
  }
  readonly equipmentService: {
    readonly repairMendingItemsWithXP: (amount: number) => Effect.Effect<number, never, never>
  }
  readonly xpService: {
    readonly addXP: (amount: number) => Effect.Effect<unknown, never, never>
  }
}

export const addExperienceWithMending = (
  amount: number,
  services: MendingExperienceServices,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const remainingAfterInventory = yield* services.inventoryService.repairMendingItemsWithXP(amount)
    const remainingAfterEquipment = yield* services.equipmentService.repairMendingItemsWithXP(remainingAfterInventory)
    if (remainingAfterEquipment > 0) {
      yield* services.xpService.addXP(remainingAfterEquipment)
    }
  })
