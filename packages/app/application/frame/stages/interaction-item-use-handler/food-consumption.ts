import { Effect, Option, Schema } from 'effect'
import { ItemTypeSchema } from '@ts-minecraft/core'
import type { ItemType } from '@ts-minecraft/core'
import { MAX_FOOD_LEVEL } from '@ts-minecraft/entity/application/hunger-service.config'
import type { FrameFoodConsumptionInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/food-consumption'
import { resolveHeldItemUseRoute } from '../interaction-item-use-routing'
import { selectedHotbarSlotIndex } from '../selected-hotbar-slot'
import { handleArmorEquipFromHotbar } from './armor-equip-from-hotbar'
import { handleFishingRodActivation } from './fishing-rod'

// Vanilla eating takes ~1.61s of holding use; the click starts the chew and
// tickFoodConsumption (called each frame by the interaction stage) finishes
// or cancels it. Module scratch keyed to the frame loop, like bow charge.
export const EAT_DURATION_SECS = 1.61
let eatingState: { readonly item: string; readonly startedAt: number } | null = null
export const resetEatingStateForTest = (): void => { eatingState = null }

export const handleFoodConsumption = (
  services: FrameFoodConsumptionInteractionServices,
  nowSecs: number,
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
    if (route.kind === 'potion') {
      // Drink: consume the potion, apply its payload, hand back the bottle.
      yield* services.inventoryService.removeBlock(item, 1, selectedHotbarSlotIndex(selectedSlot)).pipe(
        Effect.flatMap(() =>
          Option.match(route.potion.effect, {
            onNone: () => Effect.void,
            onSome: (effect) =>
              services.healthService.addStatusEffect(effect.type, effect.amplifier, effect.durationSecs),
          }),
        ),
        Effect.flatMap(() =>
          route.potion.instantHeal > 0 ? services.healthService.heal(route.potion.instantHeal) : Effect.void,
        ),
        Effect.flatMap(() => services.inventoryService.addBlock('GLASS_BOTTLE', 1)),
        Effect.catchAll(() => Effect.void),
      )
      return true
    }
    if (route.kind !== 'food') return false

    const hunger = yield* services.hungerService.getHunger()
    // Vanilla: golden apples are always edible, even at full hunger — their
    // value is the effects, not the food points.
    if (hunger.foodLevel >= MAX_FOOD_LEVEL && item !== 'GOLDEN_APPLE') return false

    // Start the chew — consumption happens in tickFoodConsumption after
    // EAT_DURATION_SECS of continued holding.
    eatingState = { item, startedAt: nowSecs }
    return true
  })

const performFoodConsumption = (
  services: FrameFoodConsumptionInteractionServices,
  item: ItemType,
  selectedSlot: Parameters<typeof selectedHotbarSlotIndex>[0],
  route: Extract<ReturnType<typeof resolveHeldItemUseRoute>, { kind: 'food' }>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {

    yield* services.inventoryService.removeBlock(item, 1, selectedHotbarSlotIndex(selectedSlot)).pipe(
      Effect.flatMap(() => services.hungerService.eat(route.food.foodLevel, route.food.saturationModifier)),
      // Vanilla golden apple: Regeneration II for 5s (the old flat heal(4) is
      // replaced by the periodic effect — ~4 HP over the duration) plus
      // Absorption I for 2 minutes (2 golden hearts soaked before health).
      // Rotten flesh: Hunger I for 30s — applied deterministically (vanilla
      // rolls 80%; this codebase prefers deterministic gameplay effects).
      Effect.flatMap(() =>
        item === 'GOLDEN_APPLE'
          ? services.healthService.addStatusEffect('REGENERATION', 1, 5).pipe(
              Effect.zipRight(services.healthService.addStatusEffect('ABSORPTION', 0, 120)),
            )
          : item === 'ROTTEN_FLESH'
            ? services.healthService.addStatusEffect('HUNGER', 0, 30)
            : Effect.void,
      ),
      Effect.catchAll(() => Effect.void),
    )
  })

// Per-frame chew ticker: cancels when the button is released or the held item
// changes; consumes after EAT_DURATION_SECS of continuous holding.
export const tickFoodConsumption = (
  services: FrameFoodConsumptionInteractionServices,
  nowSecs: number,
  useButtonHeld: boolean,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    if (eatingState === null) return
    const selected = Option.getOrNull(yield* services.hotbarService.getSelectedBlockType())
    if (!useButtonHeld || selected !== eatingState.item) {
      eatingState = null
      return
    }
    if (nowSecs - eatingState.startedAt < EAT_DURATION_SECS) return
    const item = eatingState.item
    eatingState = null
    if (!Schema.is(ItemTypeSchema)(item)) return
    const route = resolveHeldItemUseRoute(item)
    if (route.kind !== 'food') return
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    yield* performFoodConsumption(services, item, selectedSlot, route)
  })
