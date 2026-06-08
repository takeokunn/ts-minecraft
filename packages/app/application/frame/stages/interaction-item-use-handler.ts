import { Effect, Option, Schema } from 'effect'
import { SlotIndex, ItemTypeSchema } from '@ts-minecraft/core'
import { HOTBAR_START, isArmorItem, getArmorSlot } from '@ts-minecraft/inventory'
import { getFoodProperties, MAX_FOOD_LEVEL } from '@ts-minecraft/entity'
import type { FrameHandlerServices } from '@ts-minecraft/app/frame/types'

export const handleFoodConsumption = (
  services: Pick<FrameHandlerServices, 'hotbarService' | 'hungerService' | 'inventoryService' | 'equipmentService' | 'fishingService' | 'xpService'>,
): Effect.Effect<boolean, never> =>
  Effect.all(
    [services.hotbarService.getSelectedBlockType(), services.hotbarService.getSelectedSlot()],
    { concurrency: 'unbounded' },
  ).pipe(
    Effect.flatMap(([selected, selectedSlot]) =>
      Option.match(selected, {
        onNone: () => Effect.succeed(false),
        onSome: (item) => {
          if (!Schema.is(ItemTypeSchema)(item)) return Effect.succeed(false)

          if (item === 'FISHING_ROD') {
            return services.fishingService.isFishing().pipe(
              Effect.flatMap((alreadyFishing) =>
                alreadyFishing
                  ? services.fishingService.cancel().pipe(Effect.as(true))
                  : services.xpService.getXP().pipe(
                      Effect.flatMap((xp) => services.fishingService.cast(xp.totalXP + xp.xpIntoLevel)),
                      Effect.as(true),
                    ),
              ),
            )
          }

          if (isArmorItem(item)) {
            const slotIndex = SlotIndex.make(HOTBAR_START + selectedSlot)
            return services.inventoryService.getSlot(slotIndex).pipe(
              Effect.flatMap((stackOpt) =>
                Option.match(stackOpt, {
                  onNone: () => Effect.succeed(false),
                  onSome: (stack) =>
                    Option.match(getArmorSlot(stack.itemType), {
                      onNone: () => Effect.succeed(false),
                      onSome: (slot) =>
                        services.equipmentService.getEquippedItem(slot).pipe(
                          Effect.flatMap((displaced) =>
                            services.inventoryService
                              .removeBlock(item, 1, slotIndex)
                              .pipe(
                                Effect.andThen(services.equipmentService.equip(stack)),
                                // Swap: return displaced piece to inventory
                                Effect.andThen(
                                  Option.match(displaced, {
                                    onNone: () => Effect.void,
                                    onSome: (old) =>
                                      services.inventoryService.addBlock(old.itemType, 1).pipe(Effect.asVoid),
                                  }),
                                ),
                                Effect.as(true),
                                Effect.catchAll(() => Effect.succeed(false)),
                              ),
                          ),
                        ),
                    }),
                }),
              ),
            )
          }

          return Option.match(getFoodProperties(item), {
            onNone: () => Effect.succeed(false),
            onSome: (food) =>
              services.hungerService.getHunger().pipe(
                Effect.flatMap((hunger) =>
                  hunger.foodLevel >= MAX_FOOD_LEVEL
                    ? Effect.succeed(false)
                    : services.inventoryService
                        .removeBlock(item, 1, SlotIndex.make(HOTBAR_START + selectedSlot))
                        .pipe(
                          Effect.andThen(services.hungerService.eat(food.foodLevel, food.saturationModifier)),
                          Effect.as(true),
                          Effect.catchAll(() => Effect.succeed(false)),
                        ),
                ),
              ),
          })
        },
      }),
    ),
  )

export const handleUnequipArmor = (
  services: Pick<FrameHandlerServices, 'equipmentService' | 'inventoryService'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const slots = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'] as const
    for (const slot of slots) {
      const removed = yield* services.equipmentService.unequipSlot(slot)
      yield* Option.match(removed, {
        onNone: () => Effect.void,
        onSome: (stack) =>
          services.inventoryService
            .addBlock(stack.itemType, 1)
            .pipe(Effect.catchAll(() => services.equipmentService.equip(stack).pipe(Effect.asVoid))),
      })
      if (Option.isSome(removed)) return
    }
  })
