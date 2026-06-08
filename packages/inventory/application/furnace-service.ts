import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import { RecipeService } from './recipe-service'
import { InventoryService } from './inventory-service'
import { PlayerService } from '@ts-minecraft/entity/application/player-service'
import type { BlockType, InventoryItem } from '@ts-minecraft/core'
import type { RecipeId, DeltaTimeSecs } from '@ts-minecraft/core'
import { ChunkManagerService } from '@ts-minecraft/world/application/chunk-manager-service'
import { FURNACE_SMELT_DURATION_SECS } from './furnace-service.config'
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

const COAL = 'COAL' as const

/** Validates recipe, position, furnace slot availability, and inventory counts. */
const validateSmeltingPreconditions = (
  recipeService: RecipeService,
  helpers: { getSelectedFurnacePosition: () => Effect.Effect<Option.Option<{ readonly x: number; readonly y: number; readonly z: number }>, never> },
  stateRef: Ref.Ref<FurnaceState>,
  recipeId: RecipeId,
  available: HashMap.HashMap<InventoryItem, number>,
): Effect.Effect<{
  readonly input: { readonly itemType: InventoryItem; readonly count: number }
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
}, FurnaceError> =>
  Effect.gen(function* () {
    const recipe = yield* Option.match(recipeService.findById(recipeId), {
      onNone: () => Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: `Recipe not found: ${recipeId}` })),
      onSome: Effect.succeed,
    })
    if (recipe.station !== 'furnace') {
      return yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: `Recipe is not a furnace recipe: ${recipeId}` }))
    }

    const furnacePosOpt = yield* helpers.getSelectedFurnacePosition()
    const position = yield* Option.match(furnacePosOpt, {
      onNone: () => Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'No nearby furnace' })),
      onSome: Effect.succeed,
    })

    const input = recipe.ingredients[0]
    if (!input) {
      return yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'Furnace recipe has no input ingredient' }))
    }
    if (Option.getOrElse(HashMap.get(available, input.itemType), () => 0) < input.count) {
      return yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: `Missing input: ${input.itemType}` }))
    }
    if (Option.getOrElse(HashMap.get(available, COAL), () => 0) < 1) {
      return yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'Missing furnace fuel: COAL' }))
    }

    const state = yield* Ref.get(stateRef)
    const furnace = Option.getOrElse(
      HashMap.get(state.furnaces, furnaceKey(position)),
      () => emptyFurnaceAtPosition(position),
    )
    yield* Option.match(furnace.activeRecipeId, {
      onNone: () => Effect.void,
      onSome: () => Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'Furnace is already smelting' })),
    })
    yield* Option.match(furnace.output, {
      onNone: () => Effect.void,
      onSome: () => Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'Furnace output slot is occupied' })),
    })

    return { input: { itemType: input.itemType, count: input.count }, position }
  })

/** Removes fuel then input; refunds fuel if input removal fails. */
const consumeSmeltingIngredients = (
  inventoryService: InventoryService,
  input: { readonly itemType: InventoryItem; readonly count: number },
): Effect.Effect<void, FurnaceError> =>
  Effect.gen(function* () {
    yield* inventoryService.removeBlock(COAL, 1).pipe(
      Effect.mapError(() => new FurnaceError({ operation: 'startSmelting', cause: 'Missing furnace fuel: COAL' }))
    )
    yield* inventoryService.removeBlock(input.itemType as BlockType, input.count).pipe(
      Effect.catchTag('InventoryError', () =>
        inventoryService.addBlock(COAL, 1).pipe(
          Effect.ignore,
          Effect.andThen(Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: `Missing input: ${input.itemType}` })))
        )
      )
    )
  })

export class FurnaceService extends Effect.Service<FurnaceService>()(
  '@minecraft/application/FurnaceService',
  {
    effect: Effect.all([
      RecipeService,
      InventoryService,
      PlayerService,
      ChunkManagerService,
      Ref.make<FurnaceState>(INITIAL_STATE),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.map(([recipeService, inventoryService, playerService, chunkManagerService, stateRef]) => {
        const helpers = makeFurnaceHelpers(playerService, chunkManagerService, stateRef)

        return {
          getState: (): Effect.Effect<FurnaceState, never> => Ref.get(stateRef),

          getNearestFurnaceState: helpers.getNearestFurnaceState,

          hasNearbyFurnace: (): Effect.Effect<boolean, never> =>
            helpers.getSelectedFurnacePosition().pipe(Effect.map(Option.isSome)),

          setSelectedFurnace: (position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<void, never> =>
            Ref.update(stateRef, (state) => ({
              ...state,
              selectedFurnacePosition: Option.some(position),
            })),

          startSmelting: (recipeId: RecipeId): Effect.Effect<void, FurnaceError> =>
            Effect.gen(function* () {
              const slots = yield* inventoryService.getAllSlots()
              const available = Arr.reduce(slots, HashMap.empty<InventoryItem, number>(), (counts, slot) =>
                Option.match(slot, {
                  onNone: () => counts,
                  onSome: (stack) =>
                    HashMap.set(
                      counts,
                      stack.itemType,
                      Option.getOrElse(HashMap.get(counts, stack.itemType), () => 0) + stack.count,
                    ),
                }),
              )
              const { input, position } = yield* validateSmeltingPreconditions(
                recipeService, helpers, stateRef, recipeId, available,
              )
              yield* consumeSmeltingIngredients(inventoryService, input)
              const nextFurnace: FurnaceBlockState = {
                position,
                input: Option.some(input),
                fuel: Option.some({ itemType: COAL, count: 1 }),
                output: Option.none(),
                activeRecipeId: Option.some(recipeId),
                progressSecs: 0,
              }
              yield* Ref.update(stateRef, (current) => setFurnaceState(current, nextFurnace))
            }),

          collectOutput: (): Effect.Effect<boolean, FurnaceError> =>
            Effect.gen(function* () {
              const furnaceOpt = yield* helpers.getNearestFurnaceState()
              const furnace = yield* Option.match(furnaceOpt, {
                onNone: () => Effect.fail(new FurnaceError({ operation: 'collectOutput', cause: 'No nearby furnace' })),
                onSome: Effect.succeed,
              })
              const output = yield* Option.match(furnace.output, {
                onNone: () => Effect.fail(new FurnaceError({ operation: 'collectOutput', cause: 'No furnace output to collect' })),
                onSome: Effect.succeed,
              })

              const collected = yield* inventoryService.addBlock(output.itemType as BlockType, output.count).pipe(
                Effect.as(true),
                Effect.catchTag('InventoryError', () => Effect.succeed(false))
              )
              if (!collected) return false

              yield* Ref.update(stateRef, (state) =>
                setFurnaceState(state, {
                  ...furnace,
                  input: Option.none(),
                  fuel: Option.none(),
                  output: Option.none(),
                  progressSecs: 0,
                })
              )
              return true
            }),

          clearFurnace: (position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<ReadonlyArray<FurnaceItemStack>, never> =>
            Ref.modify(stateRef, (state): [ReadonlyArray<FurnaceItemStack>, FurnaceState] => {
              const key = furnaceKey(position)
              return Option.match(HashMap.get(state.furnaces, key), {
                onNone: () => [[], state] as [ReadonlyArray<FurnaceItemStack>, FurnaceState],
                onSome: (furnace) => {
                  const dropped = Arr.filterMap(
                    [furnace.input, furnace.fuel, furnace.output],
                    (slot) => slot,
                  )
                  const nextState: FurnaceState = {
                    furnaces: HashMap.remove(state.furnaces, key),
                    selectedFurnacePosition: Option.filter(state.selectedFurnacePosition, (selected) => furnaceKey(selected) !== key),
                  }
                  return [dropped, nextState]
                },
              })
            }),

          dismantleFurnace: (position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<boolean, never> =>
            Effect.gen(function* () {
              const state = yield* Ref.get(stateRef)
              const key = furnaceKey(position)
              return yield* Option.match(HashMap.get(state.furnaces, key), {
                onNone: () => Effect.succeed(true),
                onSome: (furnace) =>
                  Effect.gen(function* () {
                    const dropped = Arr.filterMap(
                      [furnace.input, furnace.fuel, furnace.output],
                      (slot) => slot,
                    )
                    const snapshot = yield* inventoryService.serialize()
                    const results = yield* Effect.forEach(
                      dropped,
                      (item) => inventoryService.addBlock(item.itemType as BlockType, item.count).pipe(
                        Effect.as(true as const),
                        Effect.catchTag('InventoryError', () => Effect.succeed(false as const)),
                      ),
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
              })
            }),

          serialize: (): Effect.Effect<ReadonlyArray<FurnaceBlockState>, never> =>
            Ref.get(stateRef).pipe(
              Effect.map((state) =>
                Arr.fromIterable(HashMap.values(state.furnaces)),
              ),
            ),

          deserialize: (serialized: ReadonlyArray<FurnaceBlockState>): Effect.Effect<void, never> =>
            Ref.set(stateRef, {
              furnaces: HashMap.fromIterable(
                Arr.map(serialized, (furnace) => [furnaceKey(furnace.position), furnace] as const),
              ),
              selectedFurnacePosition: Option.none(),
            }),

          tick: (deltaTime: DeltaTimeSecs): Effect.Effect<void, never> =>
            Ref.update(stateRef, (state) =>
              HashMap.reduce(state.furnaces, state, (acc, furnace) =>
                Option.match(furnace.activeRecipeId, {
                  onNone: () => acc,
                  onSome: (activeRecipeId) =>
                    Option.match(recipeService.findById(activeRecipeId), {
                      /* c8 ignore next */
                      onNone: () => acc,
                      onSome: (recipe) => {
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
                      },
                    }),
                }),
              )
            ),
        }
      }),
    ),
  },
) {}

export const FurnaceServiceLive = FurnaceService.Default
