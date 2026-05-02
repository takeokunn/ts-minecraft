import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import { RecipeService } from './recipe-service'
import { InventoryService } from './inventory-service'
import { GameStateService } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/kernel'
import type { BlockType } from '@ts-minecraft/kernel'
import type { RecipeId, DeltaTimeSecs, Position } from '@ts-minecraft/kernel'
import { FURNACE_SMELT_DURATION_SECS } from './furnace-service.config'

type FurnaceItemStack = {
  readonly blockType: BlockType
  readonly count: number
}

export type FurnaceBlockState = {
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly input: Option.Option<FurnaceItemStack>
  readonly fuel: Option.Option<FurnaceItemStack>
  readonly output: Option.Option<FurnaceItemStack>
  readonly activeRecipeId: Option.Option<RecipeId>
  readonly progressSecs: number
}

export type SerializedFurnaceBlockState = {
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly input: FurnaceItemStack | null
  readonly fuel: FurnaceItemStack | null
  readonly output: FurnaceItemStack | null
  readonly activeRecipeId: RecipeId | null
  readonly progressSecs: number
}

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

export class FurnaceError extends Error {
  readonly _tag = 'FurnaceError' as const

  constructor(
    readonly operation: string,
    readonly reason: string,
  ) {
    super(`Furnace error during ${operation}: ${reason}`)
  }
}

export class FurnaceService extends Effect.Service<FurnaceService>()(
  '@minecraft/application/FurnaceService',
  {
    effect: Effect.all([
      RecipeService,
      InventoryService,
      GameStateService,
      ChunkManagerService,
      Ref.make<FurnaceState>(INITIAL_STATE),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.map(([recipeService, inventoryService, gameState, chunkManagerService, stateRef]) => {
        const isFurnaceStillValid = (playerPos: Position, position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const dx = position.x - playerPos.x
            const dy = position.y - playerPos.y
            const dz = position.z - playerPos.z
            if (Math.abs(dx) > 5 || Math.abs(dy) > 2 || Math.abs(dz) > 5) return false
            if (position.y < 0 || position.y >= CHUNK_HEIGHT) return false
            const cx = Math.floor(position.x / CHUNK_SIZE)
            const cz = Math.floor(position.z / CHUNK_SIZE)
            const chunk = yield* chunkManagerService.getChunk({ x: cx, z: cz }).pipe(Effect.catchAll(() => Effect.succeed(null)))
            if (chunk === null) return false
            const lx = ((position.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            const lz = ((position.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            const idx = position.y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
            return chunk.blocks[idx] === blockTypeToIndex('FURNACE')
          })

        const getSelectedFurnacePosition = (): Effect.Effect<Option.Option<{ readonly x: number; readonly y: number; readonly z: number }>, never> =>
          Effect.gen(function* () {
            const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(Effect.catchAll(() => Effect.succeed({ x: 0, y: 0, z: 0 })))
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
                onNone: () => Effect.fail(new FurnaceError('startSmelting', `Recipe not found: ${recipeId}`)),
                onSome: Effect.succeed,
              })
              if (recipe.station !== 'furnace') {
                return yield* Effect.fail(new FurnaceError('startSmelting', `Recipe is not a furnace recipe: ${recipeId}`))
              }

              const furnacePosOpt = yield* getSelectedFurnacePosition()
              const position = yield* Option.match(furnacePosOpt, {
                onNone: () => Effect.fail(new FurnaceError('startSmelting', 'No nearby furnace')),
                onSome: Effect.succeed,
              })

              const input = recipe.ingredients[0]
              if (!input) {
                return yield* Effect.fail(new FurnaceError('startSmelting', 'Furnace recipe has no input ingredient'))
              }

              const slots = yield* inventoryService.getAllSlots()
              const available = Arr.reduce(slots, HashMap.empty<BlockType, number>(), (counts, slot) =>
                Option.match(slot, {
                  onNone: () => counts,
                  onSome: (stack) =>
                    HashMap.set(
                      counts,
                      stack.blockType,
                      Option.getOrElse(HashMap.get(counts, stack.blockType), () => 0) + stack.count,
                    ),
                }),
              )
              if (Option.getOrElse(HashMap.get(available, input.blockType), () => 0) < input.count) {
                return yield* Effect.fail(new FurnaceError('startSmelting', `Missing input: ${input.blockType}`))
              }
              if (Option.getOrElse(HashMap.get(available, 'COAL' as BlockType), () => 0) < 1) {
                return yield* Effect.fail(new FurnaceError('startSmelting', 'Missing furnace fuel: COAL'))
              }

              const state = yield* Ref.get(stateRef)
              const furnace = Option.getOrElse(
                HashMap.get(state.furnaces, furnaceKey(position)),
                () => emptyFurnaceAtPosition(position),
              )
              yield* Option.match(furnace.activeRecipeId, {
                onNone: () => Effect.void,
                onSome: () => Effect.fail(new FurnaceError('startSmelting', 'Furnace is already smelting')),
              })
              yield* Option.match(furnace.output, {
                onNone: () => Effect.void,
                onSome: () => Effect.fail(new FurnaceError('startSmelting', 'Furnace output slot is occupied')),
              })

              const removedFuel = yield* inventoryService.removeBlock('COAL', 1)
              if (!removedFuel) {
                return yield* Effect.fail(new FurnaceError('startSmelting', 'Missing furnace fuel: COAL'))
              }
              const removedInput = yield* inventoryService.removeBlock(input.blockType, input.count)
              if (!removedInput) {
                yield* inventoryService.addBlock('COAL', 1)
                return yield* Effect.fail(new FurnaceError('startSmelting', `Missing input: ${input.blockType}`))
              }

              const nextFurnace: FurnaceBlockState = {
                position,
                input: Option.some({ blockType: input.blockType, count: input.count }),
                fuel: Option.some({ blockType: 'COAL', count: 1 }),
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
                onNone: () => Effect.fail(new FurnaceError('collectOutput', 'No nearby furnace')),
                onSome: Effect.succeed,
              })
              const output = yield* Option.match(furnace.output, {
                onNone: () => Effect.fail(new FurnaceError('collectOutput', 'No furnace output to collect')),
                onSome: Effect.succeed,
              })

              const added = yield* inventoryService.addBlock(output.blockType, output.count)
              if (!added) return false

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
                  const dropped = [furnace.input, furnace.fuel, furnace.output].flatMap((slot) =>
                    Option.match(slot, {
                      onNone: () => [],
                      onSome: (item) => [item],
                    }),
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
                    const dropped = [furnace.input, furnace.fuel, furnace.output].flatMap((slot) =>
                      Option.match(slot, {
                        onNone: () => [],
                        onSome: (item) => [item],
                      }),
                    )
                    const results = yield* Effect.forEach(
                      dropped,
                      (item) => inventoryService.addBlock(item.blockType, item.count),
                      { concurrency: 'unbounded' },
                    )
                    if (results.every(Boolean)) {
                      yield* Ref.set(stateRef, {
                        furnaces: HashMap.remove(state.furnaces, key),
                        selectedFurnacePosition: Option.filter(state.selectedFurnacePosition, (selected) => furnaceKey(selected) !== key),
                      })
                      return true
                    }
                    return false
                  }),
              })
            }),

          serialize: (): Effect.Effect<ReadonlyArray<SerializedFurnaceBlockState>, never> =>
            Ref.get(stateRef).pipe(
              Effect.map((state) =>
                Arr.map(Arr.fromIterable(HashMap.values(state.furnaces)), (furnace) => ({
                  position: furnace.position,
                  input: Option.getOrNull(furnace.input),
                  fuel: Option.getOrNull(furnace.fuel),
                  output: Option.getOrNull(furnace.output),
                  activeRecipeId: Option.getOrNull(furnace.activeRecipeId),
                  progressSecs: furnace.progressSecs,
                })),
              ),
            ),

          deserialize: (serialized: ReadonlyArray<SerializedFurnaceBlockState>): Effect.Effect<void, never> =>
            Ref.set(stateRef, {
              furnaces: HashMap.fromIterable(
                Arr.map(serialized, (furnace) => [
                  furnaceKey(furnace.position),
                  {
                    position: furnace.position,
                    input: Option.fromNullable(furnace.input),
                    fuel: Option.fromNullable(furnace.fuel),
                    output: Option.fromNullable(furnace.output),
                    activeRecipeId: Option.fromNullable(furnace.activeRecipeId),
                    progressSecs: furnace.progressSecs,
                  } satisfies FurnaceBlockState,
                ] as const),
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
                          output: Option.some({ blockType: recipe.output.blockType, count: recipe.output.count }),
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
