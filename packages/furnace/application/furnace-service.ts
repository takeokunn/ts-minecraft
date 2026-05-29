import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import { RecipeService, InventoryService } from '@ts-minecraft/inventory'
import { PlayerService } from '@ts-minecraft/player'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/kernel'
import type { BlockType, ItemType, InventoryItem } from '@ts-minecraft/kernel'
import type { RecipeId, DeltaTimeSecs, Position } from '@ts-minecraft/kernel'
import { FURNACE_SMELT_DURATION_SECS } from './furnace-service.config'
import { FurnaceError } from '../domain/errors'
import type { FurnaceBlockState, FurnaceItemStack } from '../domain/furnace-state'

type FurnaceState = {
  readonly furnaces: HashMap.HashMap<string, FurnaceBlockState>
  readonly selectedFurnacePosition: Option.Option<{ readonly x: number; readonly y: number; readonly z: number }>
}

const INITIAL_STATE: FurnaceState = {
  furnaces: HashMap.empty<string, FurnaceBlockState>(),
  selectedFurnacePosition: Option.none(),
}

const furnaceKey = (position: { readonly x: number; readonly y: number; readonly z: number }): string => `${position.x},${position.y},${position.z}`

const emptyFurnaceAtPosition = (position: { readonly x: number; readonly y: number; readonly z: number }): FurnaceBlockState => ({
  position,
  input: Option.none(),
  fuel: Option.none(),
  output: Option.none(),
  activeRecipeId: Option.none(),
  progressSecs: 0,
})

const setFurnaceState = (
  state: FurnaceState,
  furnace: FurnaceBlockState,
): FurnaceState => ({
  furnaces: HashMap.set(state.furnaces, furnaceKey(furnace.position), furnace),
  selectedFurnacePosition: state.selectedFurnacePosition,
})

export class FurnaceService extends Effect.Service<FurnaceService>()(
  '@minecraft/application/FurnaceService',
  {
    effect: Effect.all([
      RecipeService,
      InventoryService,
      PlayerService,
      Effect.suspend(() => ChunkManagerService), // lazy: breaks circular init with terrain
      Ref.make<FurnaceState>(INITIAL_STATE),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.map(([recipeService, inventoryService, playerService, chunkManagerService, stateRef]) => {
        const COAL: ItemType = 'COAL'

        const isFurnaceStillValid = (playerPos: Position, position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const dx = position.x - playerPos.x
            const dy = position.y - playerPos.y
            const dz = position.z - playerPos.z
            if (Math.abs(dx) > 5 || Math.abs(dy) > 2 || Math.abs(dz) > 5) return false
            if (position.y < 0 || position.y >= CHUNK_HEIGHT) return false
            const cx = Math.floor(position.x / CHUNK_SIZE)
            const cz = Math.floor(position.z / CHUNK_SIZE)
            const chunk = Option.getOrNull(yield* chunkManagerService.getChunk({ x: cx, z: cz }).pipe(Effect.option))
            if (chunk === null) return false
            const lx = ((position.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            const lz = ((position.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            const idx = position.y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
            return chunk.blocks[idx] === blockTypeToIndex('FURNACE')
          })

        const getSelectedFurnacePosition = (): Effect.Effect<Option.Option<{ readonly x: number; readonly y: number; readonly z: number }>, never> =>
          Effect.gen(function* () {
            const playerPos = yield* playerService.getPosition(DEFAULT_PLAYER_ID).pipe(Effect.catchAll(() => Effect.succeed({ x: 0, y: 0, z: 0 })))
            const state = yield* Ref.get(stateRef)
            return yield* Option.match(state.selectedFurnacePosition, {
              onNone: () => Effect.succeed(Option.none<{ readonly x: number; readonly y: number; readonly z: number }>()),
              onSome: (selected) =>
                isFurnaceStillValid(playerPos, selected).pipe(
                  Effect.flatMap((isValid) =>
                    isValid
                      ? Effect.succeed(Option.some(selected))
                      : Ref.update(stateRef, (current) => ({ ...current, selectedFurnacePosition: Option.none() })).pipe(
                          Effect.as(Option.none<{ readonly x: number; readonly y: number; readonly z: number }>()),
                        ),
                  ),
                ),
            })
          })

        const getNearestFurnaceState = (): Effect.Effect<Option.Option<FurnaceBlockState>, never> =>
          Effect.gen(function* () {
            const furnacePosOpt = yield* getSelectedFurnacePosition()
            const state = yield* Ref.get(stateRef)
            return Option.map(furnacePosOpt, (position) =>
              Option.getOrElse(HashMap.get(state.furnaces, furnaceKey(position)), () => emptyFurnaceAtPosition(position)),
            )
          })

        return {
          getState: (): Effect.Effect<FurnaceState, never> => Ref.get(stateRef),

          getNearestFurnaceState,

          hasNearbyFurnace: (): Effect.Effect<boolean, never> =>
            getSelectedFurnacePosition().pipe(Effect.map(Option.isSome)),

          setSelectedFurnace: (position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<void, never> =>
            Ref.update(stateRef, (state) => ({
              ...state,
              selectedFurnacePosition: Option.some(position),
            })),

          startSmelting: (recipeId: RecipeId): Effect.Effect<void, FurnaceError> =>
            Effect.gen(function* () {
              const recipe = yield* Option.match(recipeService.findById(recipeId), {
                onNone: () => Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: `Recipe not found: ${recipeId}` })),
                onSome: Effect.succeed,
              })
              if (recipe.station !== 'furnace') {
                return yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: `Recipe is not a furnace recipe: ${recipeId}` }))
              }

              const furnacePosOpt = yield* getSelectedFurnacePosition()
              const position = yield* Option.match(furnacePosOpt, {
                onNone: () => Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'No nearby furnace' })),
                onSome: Effect.succeed,
              })

              const input = recipe.ingredients[0]
              if (!input) {
                return yield* Effect.fail(new FurnaceError({ operation: 'startSmelting', cause: 'Furnace recipe has no input ingredient' }))
              }

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

              const nextFurnace: FurnaceBlockState = {
                position,
                input: Option.some({ itemType: input.itemType, count: input.count }),
                fuel: Option.some({ itemType: COAL, count: 1 }),
                output: Option.none(),
                activeRecipeId: Option.some(recipeId),
                progressSecs: 0,
              }
              yield* Ref.set(stateRef, setFurnaceState(state, nextFurnace))
            }),

          collectOutput: (): Effect.Effect<boolean, FurnaceError> =>
            Effect.gen(function* () {
              const furnaceOpt = yield* getNearestFurnaceState()
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

              const state = yield* Ref.get(stateRef)
              yield* Ref.set(stateRef, setFurnaceState(state, {
                ...furnace,
                input: Option.none(),
                fuel: Option.none(),
                output: Option.none(),
                progressSecs: 0,
              }))
              return true
            }),

          clearFurnace: (position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<ReadonlyArray<FurnaceItemStack>, never> =>
            Effect.gen(function* () {
              const state = yield* Ref.get(stateRef)
              const key = furnaceKey(position)
              return yield* Option.match(HashMap.get(state.furnaces, key), {
                onNone: () => Effect.succeed<ReadonlyArray<FurnaceItemStack>>([]),
                onSome: (furnace) => {
                  const dropped = Arr.filterMap(
                    [furnace.input, furnace.fuel, furnace.output],
                    (slot) => slot,
                  )
                  return Ref.set(stateRef, {
                    furnaces: HashMap.remove(state.furnaces, key),
                    selectedFurnacePosition: Option.filter(state.selectedFurnacePosition, (selected) => furnaceKey(selected) !== key),
                  }).pipe(Effect.as<ReadonlyArray<FurnaceItemStack>>(dropped))
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
                    // Snapshot the inventory before adding so a PARTIAL success
                    // (e.g. fuel fits but the output does not) can be undone.
                    // Without rollback the items that DID fit would be duplicated:
                    // left in the inventory AND in the furnace, which stays put
                    // because we only remove it when every add succeeds.
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
                      yield* Ref.set(stateRef, {
                        furnaces: HashMap.remove(state.furnaces, key),
                        selectedFurnacePosition: Option.filter(state.selectedFurnacePosition, (selected) => furnaceKey(selected) !== key),
                      })
                      return true
                    }
                    // Partial failure: roll back any successful adds and keep the
                    // furnace intact, so dismantling a furnace into an almost-full
                    // inventory neither duplicates nor loses items.
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
            Effect.gen(function* () {
              const state = yield* Ref.get(stateRef)
              const nextState = HashMap.reduce(state.furnaces, state, (acc, furnace) =>
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

              yield* Ref.set(stateRef, nextState)
            }),
        }
      }),
    ),
  },
) {}

export const FurnaceServiceLive = FurnaceService.Default
