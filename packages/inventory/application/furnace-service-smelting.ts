import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import type { BlockType, InventoryItem, RecipeId } from '@ts-minecraft/core'
import type { InventoryService } from './inventory-service'
import type { RecipeService } from './recipe-service'
import {
  FURNACE_FUEL_BURN_DURATION_SECS,
  FURNACE_FUEL_ITEMS,
  FURNACE_SMELT_DURATION_SECS,
  type FurnaceFuelItem,
} from './furnace-service.config'
import { FurnaceError } from '../domain/furnace-errors'
import type { FurnaceBlockState } from '../domain/furnace-state'
import { advanceFurnaceSmeltingProgress } from '../domain/furnace-smelting'
import {
  type FurnaceState,
  emptyFurnaceAtPosition,
  furnaceKey,
} from '../domain/furnace-service-utils'

const findAvailableFuel = (available: HashMap.HashMap<InventoryItem, number>): FurnaceFuelItem | undefined =>
  FURNACE_FUEL_ITEMS.find((item) => Option.getOrElse(HashMap.get(available, item), () => 0) >= 1)

export const getFuelBurnDurationSecs = (fuel: FurnaceFuelItem): number =>
  FURNACE_FUEL_BURN_DURATION_SECS[fuel]

export const getAvailableInventoryCounts = (
  inventoryService: InventoryService,
): Effect.Effect<HashMap.HashMap<InventoryItem, number>, never> =>
  Effect.gen(function* () {
    const slots = yield* inventoryService.getAllSlots()
    return Arr.reduce(slots, HashMap.empty<InventoryItem, number>(), (counts, slot) => {
      const stack = Option.getOrNull(slot)
      if (stack === null || stack.count <= 0) return counts
      return HashMap.set(counts, stack.itemType, Option.getOrElse(HashMap.get(counts, stack.itemType), () => 0) + stack.count)
    })
  })

const consumeNextFuelFromInventory = (
  inventoryService: InventoryService,
): Effect.Effect<Option.Option<{ readonly itemType: FurnaceFuelItem; readonly burnSecs: number }>, never> =>
  Effect.gen(function* () {
    const available = yield* getAvailableInventoryCounts(inventoryService)
    const fuel = findAvailableFuel(available)
    if (!fuel) return Option.none()
    const consumed = yield* inventoryService.removeBlock(fuel, 1).pipe(
      Effect.as(true),
      Effect.catchTag('InventoryError', () => Effect.succeed(false)),
    )
    return consumed
      ? Option.some({ itemType: fuel, burnSecs: getFuelBurnDurationSecs(fuel) })
      : Option.none()
  })

export const validateSmeltingPreconditions = (
  recipeService: RecipeService,
  helpers: { getSelectedFurnacePosition: () => Effect.Effect<Option.Option<{ readonly x: number; readonly y: number; readonly z: number }>, never> },
  stateRef: Ref.Ref<FurnaceState>,
  recipeId: RecipeId,
  available: HashMap.HashMap<InventoryItem, number>,
): Effect.Effect<{
  readonly input: { readonly itemType: InventoryItem; readonly count: number }
  readonly fuel: Option.Option<FurnaceFuelItem>
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly burnRemainingSecs: number
  readonly burnTotalSecs: number | undefined
}, FurnaceError> =>
  Effect.gen(function* () {
    const recipe = Option.getOrNull(recipeService.findById(recipeId))
    if (recipe === null) return yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: `Recipe not found: ${recipeId}` }))
    if (recipe.station !== 'furnace') {
      return yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: `Recipe is not a furnace recipe: ${recipeId}` }))
    }

    const position = Option.getOrNull(yield* helpers.getSelectedFurnacePosition())
    if (position === null) return yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'No nearby furnace' }))

    const input = recipe.ingredients[0]
    if (!input) {
      return yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'Furnace recipe has no input ingredient' }))
    }
    if (Option.getOrElse(HashMap.get(available, input.itemType), () => 0) < input.count) {
      return yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: `Missing input: ${input.itemType}` }))
    }
    const state = yield* Ref.get(stateRef)
    const furnace = Option.getOrElse(
      HashMap.get(state.furnaces, furnaceKey(position)),
      () => emptyFurnaceAtPosition(position),
    )
    if (Option.isSome(furnace.activeRecipeId)) yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'Furnace is already smelting' }))
    if (Option.isSome(furnace.output)) yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'Furnace output slot is occupied' }))

    const burnRemainingSecs = furnace.burnRemainingSecs ?? 0
    const fuel = burnRemainingSecs > 0 ? undefined : findAvailableFuel(available)
    if (burnRemainingSecs <= 0 && !fuel) {
      return yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'Missing furnace fuel' }))
    }

    return {
      input: { itemType: input.itemType, count: input.count },
      fuel: fuel ? Option.some(fuel) : Option.none(),
      position,
      burnRemainingSecs,
      burnTotalSecs: furnace.burnTotalSecs,
    }
  })

export const consumeSmeltingIngredients = (
  inventoryService: InventoryService,
  input: { readonly itemType: InventoryItem; readonly count: number },
  fuel: Option.Option<FurnaceFuelItem>,
): Effect.Effect<void, FurnaceError> =>
  Effect.gen(function* () {
    const fuelItem = Option.getOrNull(fuel)
    if (fuelItem !== null) {
      yield* inventoryService.removeBlock(fuelItem, 1).pipe(
        Effect.mapError(() => new FurnaceError({ operation: 'startSmelting', cause: 'Missing furnace fuel' }))
      )
    }
    yield* inventoryService.removeBlock(input.itemType as BlockType, input.count).pipe(
      Effect.catchTag('InventoryError', () => {
        const refundFuel = fuelItem === null
          ? Effect.void
          : inventoryService.addBlock(fuelItem, 1).pipe(Effect.ignore)
        const cause = 'Missing input: '.concat(input.itemType)
        const error = new FurnaceError({ operation: 'startSmelting', cause })
        return refundFuel.pipe(Effect.zipRight(Effect.fail(error)))
      })
    )
  })

export const advanceFurnace = (
  furnace: FurnaceBlockState,
  recipeService: RecipeService,
  inventoryService: InventoryService,
  deltaTime: DeltaTimeSecs,
): Effect.Effect<FurnaceBlockState, never> =>
  Effect.gen(function* () {
    const activeRecipeId = Option.getOrNull(furnace.activeRecipeId)
    if (activeRecipeId === null) return furnace
    const recipe = Option.getOrNull(recipeService.findById(activeRecipeId))
    /* c8 ignore next */
    if (recipe === null) return furnace

    let currentFurnace = furnace
    let remainingDelta = deltaTime as number

    while (remainingDelta > 0 && Option.isSome(currentFurnace.activeRecipeId)) {
      if ((currentFurnace.burnRemainingSecs ?? 0) <= 0) {
        const nextFuel = Option.getOrNull(yield* consumeNextFuelFromInventory(inventoryService))
        if (nextFuel === null) {
          return {
            ...currentFurnace,
            fuel: Option.none(),
            burnRemainingSecs: 0,
            burnTotalSecs: currentFurnace.burnTotalSecs,
          }
        }
        currentFurnace = {
          ...currentFurnace,
          fuel: Option.some({ itemType: nextFuel.itemType, count: 1 }),
          burnRemainingSecs: nextFuel.burnSecs,
          burnTotalSecs: nextFuel.burnSecs,
        }
      }

      const advanceResult = advanceFurnaceSmeltingProgress(
        currentFurnace,
        DeltaTimeSecs.make(remainingDelta),
        FURNACE_SMELT_DURATION_SECS,
        { itemType: recipe.output.itemType, count: recipe.output.count },
      )
      currentFurnace = advanceResult.furnace
      remainingDelta = advanceResult.remainingDeltaSecs
    }

    return currentFurnace
  })
