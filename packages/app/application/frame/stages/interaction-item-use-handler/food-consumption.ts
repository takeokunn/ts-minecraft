import { Effect, Option, Schema } from 'effect'
import { ItemTypeSchema } from '@ts-minecraft/core'
import { MAX_FOOD_LEVEL } from '@ts-minecraft/entity/application/hunger-service.config'
import type { FrameFoodConsumptionInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/food-consumption'
import { resolveHeldItemUseRoute } from '../interaction-item-use-routing'
import { selectedHotbarSlotIndex } from '../selected-hotbar-slot'
import { handleArmorEquipFromHotbar } from './armor-equip-from-hotbar'
import { handleFishingRodActivation } from './fishing-rod'

export const handleFoodConsumption = (
  services: FrameFoodConsumptionInteractionServices,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const selected = yield* services.hotbarService.getSelectedBlockType()
    const item = Option.getOrNull(selected)
    if (item === null) return false
    if (!Schema.is(ItemTypeSchema)(item)) return false
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()

    const route = resolveHeldItemUseRoute(item)
    if (route.kind === 'fishingRod') return yield* handleFishingRodActivation(services, selectedSlot)
    if (route.kind === 'armor') return yield* handleArmorEquipFromHotbar(services, selectedSlot, item)
    if (route.kind !== 'food') return false

    const hunger = yield* services.hungerService.getHunger()
    if (hunger.foodLevel >= MAX_FOOD_LEVEL) return false

    yield* services.inventoryService.removeBlock(item, 1, selectedHotbarSlotIndex(selectedSlot)).pipe(
      Effect.flatMap(() => services.hungerService.eat(route.food.foodLevel, route.food.saturationModifier)),
      Effect.flatMap(() => (item === 'GOLDEN_APPLE' ? services.healthService.heal(4) : Effect.void)),
      Effect.catchAll(() => Effect.void),
    )
    return true
  })
