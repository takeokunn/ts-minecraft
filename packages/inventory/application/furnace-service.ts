import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import { RecipeService } from './recipe-service'
import { InventoryService } from './inventory-service'
import { PlayerService } from '@ts-minecraft/entity/application/player-service'
import type { BlockType, InventoryItem } from '@ts-minecraft/core'
import type { RecipeId, DeltaTimeSecs } from '@ts-minecraft/core'
import { ChunkManagerService } from '@ts-minecraft/world/application/chunk-manager-service'
import { FURNACE_SMELT_DURATION_SECS, FURNACE_FUEL_ITEMS, SMELTING_XP_PER_ITEM } from './furnace-service.config'
import { FurnaceError } from '../domain/furnace-errors'
import type { FurnaceBlockState, FurnaceItemStack } from '../domain/furnace-state'
import {
  type FurnaceState,
  INITIAL_STATE,
  emptyFurnaceAtPosition,
  furnaceKey,
  setFurnaceState,
} from '../domain/furnace-service-utils'
import { makeFurnaceHelpers } from './furnace-service-helpers'

// ── startSmelting helpers ─────────────────────────────────────────────────────

/** Returns the first fuel item available in the player's inventory, or undefined. */
const findAvailableFuel = (available: HashMap.HashMap<InventoryItem, number>): InventoryItem | undefined =>
  FURNACE_FUEL_ITEMS.find((item) => Option.getOrElse(HashMap.get(available, item), () => 0) >= 1)

/** Validates recipe, position, furnace slot availability, and inventory counts. */
const validateSmeltingPreconditions = (
  recipeService: RecipeService,
  helpers: { getSelectedFurnacePosition: () => Effect.Effect<Option.Option<{ readonly x: number; readonly y: number; readonly z: number }>, never> },
  stateRef: Ref.Ref<FurnaceState>,
  recipeId: RecipeId,
  available: HashMap.HashMap<InventoryItem, number>,
): Effect.Effect<{
  readonly input: { readonly itemType: InventoryItem; readonly count: number }
  readonly fuel: InventoryItem
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
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
    const fuel = findAvailableFuel(available)
    if (!fuel) {
      return yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'Missing furnace fuel' }))
    }

    const state = yield* Ref.get(stateRef)
    const furnace = Option.getOrElse(
      HashMap.get(state.furnaces, furnaceKey(position)),
      () => emptyFurnaceAtPosition(position),
    )
    if (Option.isSome(furnace.activeRecipeId)) yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'Furnace is already smelting' }))
    if (Option.isSome(furnace.output)) yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'Furnace output slot is occupied' }))

    return { input: { itemType: input.itemType, count: input.count }, fuel, position }
  })

/** Removes fuel then input; refunds fuel if input removal fails. */
const consumeSmeltingIngredients = (
  inventoryService: InventoryService,
  input: { readonly itemType: InventoryItem; readonly count: number },
  fuel: InventoryItem,
): Effect.Effect<void, FurnaceError> =>
  Effect.gen(function* () {
    yield* inventoryService.removeBlock(fuel, 1).pipe(
      Effect.mapError(() => new FurnaceError({ operation: 'startSmelting', cause: 'Missing furnace fuel' }))
    )
    yield* inventoryService.removeBlock(input.itemType as BlockType, input.count).pipe(
      Effect.catchTag('InventoryError', () =>
        Effect.gen(function* () {
          yield* inventoryService.addBlock(fuel, 1).pipe(Effect.ignore)
          yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: `Missing input: ${input.itemType}` }))
        })
      )
    )
  })

export class FurnaceService extends Effect.Service<FurnaceService>()(
  '@minecraft/application/FurnaceService',
  {
    effect: Effect.gen(function* () {
      const recipeService = yield* RecipeService
      const inventoryService = yield* InventoryService
      const playerService = yield* PlayerService
      const chunkManagerService = yield* ChunkManagerService
      const stateRef = yield* Ref.make<FurnaceState>(INITIAL_STATE)
      const helpers = makeFurnaceHelpers(playerService, chunkManagerService, stateRef)
      return {
          getState: (): Effect.Effect<FurnaceState, never> => Ref.get(stateRef),

          getNearestFurnaceState: helpers.getNearestFurnaceState,

          hasNearbyFurnace: (): Effect.Effect<boolean, never> =>
            Effect.gen(function* () {
              const pos = yield* helpers.getSelectedFurnacePosition()
              return Option.isSome(pos)
            }),

          setSelectedFurnace: (position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<void, never> =>
            Ref.update(stateRef, (state) => ({
              ...state,
              selectedFurnacePosition: Option.some(position),
            })),

          startSmelting: (recipeId: RecipeId): Effect.Effect<void, FurnaceError> =>
            Effect.gen(function* () {
              const slots = yield* inventoryService.getAllSlots()
              const available = Arr.reduce(slots, HashMap.empty<InventoryItem, number>(), (counts, slot) => {
                const stack = Option.getOrNull(slot)
                if (stack === null) return counts
                return HashMap.set(counts, stack.itemType, Option.getOrElse(HashMap.get(counts, stack.itemType), () => 0) + stack.count)
              })
              const { input, fuel, position } = yield* validateSmeltingPreconditions(
                recipeService, helpers, stateRef, recipeId, available,
              )
              yield* consumeSmeltingIngredients(inventoryService, input, fuel)
              const nextFurnace: FurnaceBlockState = {
                position,
                input: Option.some(input),
                fuel: Option.some({ itemType: fuel, count: 1 }),
                output: Option.none(),
                activeRecipeId: Option.some(recipeId),
                progressSecs: 0,
              }
              yield* Ref.update(stateRef, (current) => setFurnaceState(current, nextFurnace))
            }),

          collectOutput: (): Effect.Effect<{ readonly collected: boolean; readonly xp: number }, FurnaceError> =>
            Effect.gen(function* () {
              const furnaceOpt = yield* helpers.getNearestFurnaceState()
              const furnace = Option.getOrNull(furnaceOpt)
              if (furnace === null) return yield* Effect.fail(new FurnaceError({ operation: 'collectOutput', cause: 'No nearby furnace' }))
              const output = Option.getOrNull(furnace.output)
              if (output === null) return yield* Effect.fail(new FurnaceError({ operation: 'collectOutput', cause: 'No furnace output to collect' }))

              const collected = yield* Effect.gen(function* () {
                yield* inventoryService.addBlock(output.itemType as BlockType, output.count)
                return true
              }).pipe(Effect.catchTag('InventoryError', () => Effect.succeed(false)))
              if (!collected) return { collected: false, xp: 0 }

              yield* Ref.update(stateRef, (state) =>
                setFurnaceState(state, {
                  ...furnace,
                  input: Option.none(),
                  fuel: Option.none(),
                  output: Option.none(),
                  progressSecs: 0,
                })
              )
              const xpRate = SMELTING_XP_PER_ITEM[output.itemType as InventoryItem] ?? 0
              const xp = xpRate > 0 ? Math.max(1, Math.round(output.count * xpRate)) : 0
              return { collected: true, xp }
            }),

          clearFurnace: (position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<ReadonlyArray<FurnaceItemStack>, never> =>
            Ref.modify(stateRef, (state): [ReadonlyArray<FurnaceItemStack>, FurnaceState] => {
              const key = furnaceKey(position)
              const furnace = Option.getOrNull(HashMap.get(state.furnaces, key))
              if (furnace === null) return [[], state]
              const dropped = Arr.filterMap([furnace.input, furnace.fuel, furnace.output], (slot) => slot)
              const nextState: FurnaceState = {
                furnaces: HashMap.remove(state.furnaces, key),
                selectedFurnacePosition: Option.filter(state.selectedFurnacePosition, (selected) => furnaceKey(selected) !== key),
              }
              return [dropped, nextState]
            }),

          dismantleFurnace: (position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<boolean, never> =>
            Effect.gen(function* () {
              const state = yield* Ref.get(stateRef)
              const key = furnaceKey(position)
              const furnace = Option.getOrNull(HashMap.get(state.furnaces, key))
              if (furnace === null) return true
              const dropped = Arr.filterMap([furnace.input, furnace.fuel, furnace.output], (slot) => slot)
              const snapshot = yield* inventoryService.serialize()
              const results = yield* Effect.forEach(
                dropped,
                (item) => Effect.gen(function* () {
                  yield* inventoryService.addBlock(item.itemType as BlockType, item.count)
                  return true as const
                }).pipe(Effect.catchTag('InventoryError', () => Effect.succeed(false as const))),
                { concurrency: 1 },
              )
              if (Arr.every(results, (r) => r)) {
                yield* Ref.update(stateRef, (current): FurnaceState => ({
                  furnaces: HashMap.remove(current.furnaces, key),
                  selectedFurnacePosition: Option.filter(state.selectedFurnacePosition, (selected) => furnaceKey(selected) !== key),
                }))
                return true
              }
              yield* inventoryService.deserialize(snapshot)
              return false
            }),

          serialize: (): Effect.Effect<ReadonlyArray<FurnaceBlockState>, never> =>
            Effect.gen(function* () {
              const state = yield* Ref.get(stateRef)
              return Arr.fromIterable(HashMap.values(state.furnaces))
            }),

          deserialize: (serialized: ReadonlyArray<FurnaceBlockState>): Effect.Effect<void, never> =>
            Ref.set(stateRef, {
              furnaces: HashMap.fromIterable(
                Arr.map(serialized, (furnace) => [furnaceKey(furnace.position), furnace] as const),
              ),
              selectedFurnacePosition: Option.none(),
            }),

          tick: (deltaTime: DeltaTimeSecs): Effect.Effect<void, never> =>
            Ref.update(stateRef, (state) =>
              HashMap.reduce(state.furnaces, state, (acc, furnace) => {
                const activeRecipeId = Option.getOrNull(furnace.activeRecipeId)
                if (activeRecipeId === null) return acc
                const recipe = Option.getOrNull(recipeService.findById(activeRecipeId))
                /* c8 ignore next */
                if (recipe === null) return acc
                const nextProgress = furnace.progressSecs + deltaTime
                if (nextProgress < FURNACE_SMELT_DURATION_SECS) {
                  return setFurnaceState(acc, { ...furnace, progressSecs: nextProgress })
                }
                return setFurnaceState(acc, {
                  ...furnace,
                  input: Option.none(),
                  fuel: Option.none(),
                  output: Option.some({ itemType: recipe.output.itemType, count: recipe.output.count }),
                  activeRecipeId: Option.none(),
                  progressSecs: FURNACE_SMELT_DURATION_SECS,
                })
              })
            ),
        }
    }),
  },
) {}

export const FurnaceServiceLive = FurnaceService.Default
