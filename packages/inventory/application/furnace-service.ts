import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import { RecipeService } from './recipe-service'
import { InventoryService } from './inventory-service'
import type { BlockType, DeltaTimeSecs, RecipeId } from '@ts-minecraft/core'
import { PlayerServicePort, WorldBlockQueryPort } from '@ts-minecraft/world'
import { FurnaceError } from '../domain/furnace-errors'
import type { FurnaceBlockState, FurnaceItemStack } from '../domain/furnace-state'
import {
  type FurnaceState,
  INITIAL_STATE,
  setFurnaceState,
} from '../domain/furnace-service-utils'
import { makeFurnaceHelpers, tryDismantleFurnaceItems } from './furnace-service-helpers'
import {
  removeFurnaceAtPosition,
  resetFurnaceAfterOutputCollected,
} from './furnace-service-state'
import { deserializeFurnaceState, serializeFurnaceState } from './furnace-persistence'
import {
  advanceFurnace,
  consumeSmeltingIngredients,
  getAvailableInventoryCounts,
  getFuelBurnDurationSecs,
  validateSmeltingPreconditions,
} from './furnace-service-smelting'
import { calculateSmeltingXp } from './furnace-service-xp'

export class FurnaceService extends Effect.Service<FurnaceService>()(
  '@minecraft/application/FurnaceService',
  {
    effect: Effect.gen(function* () {
      const recipeService = yield* RecipeService
      const inventoryService = yield* InventoryService
      const playerService = yield* PlayerServicePort
      const worldBlockQueryPort = yield* WorldBlockQueryPort
      const stateRef = yield* Ref.make<FurnaceState>(INITIAL_STATE)
      const helpers = makeFurnaceHelpers(playerService, worldBlockQueryPort, stateRef)
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
            const available = yield* getAvailableInventoryCounts(inventoryService)
            const { input, fuel, position, burnRemainingSecs, burnTotalSecs } = yield* validateSmeltingPreconditions(
              recipeService,
              helpers,
              stateRef,
              recipeId,
              available,
            )
            yield* consumeSmeltingIngredients(inventoryService, input, fuel)
            const fuelItem = Option.getOrNull(fuel)
            const nextBurnDurationSecs = fuelItem === null ? burnRemainingSecs : getFuelBurnDurationSecs(fuelItem)
            const nextFurnace: FurnaceBlockState = {
              position,
              input: Option.some(input),
              fuel: fuelItem === null ? Option.none() : Option.some({ itemType: fuelItem, count: 1 }),
              output: Option.none(),
              activeRecipeId: Option.some(recipeId),
              progressSecs: 0,
              burnRemainingSecs: nextBurnDurationSecs,
              burnTotalSecs: fuelItem === null ? burnTotalSecs : nextBurnDurationSecs,
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

            yield* Ref.update(stateRef, (state) => setFurnaceState(state, resetFurnaceAfterOutputCollected(furnace)))
            const xp = calculateSmeltingXp(output)
            return { collected: true, xp }
          }),

        clearFurnace: (position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<ReadonlyArray<FurnaceItemStack>, never> =>
          Ref.modify(stateRef, (state): readonly [ReadonlyArray<FurnaceItemStack>, FurnaceState] =>
            removeFurnaceAtPosition(state, position),
          ),

        dismantleFurnace: (position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            const [dropped, nextState] = removeFurnaceAtPosition(state, position)
            const succeeded = yield* tryDismantleFurnaceItems(inventoryService, dropped)
            if (succeeded) {
              yield* Ref.set(stateRef, nextState)
              return true
            }
            return false
          }),

        serialize: (): Effect.Effect<ReadonlyArray<FurnaceBlockState>, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return serializeFurnaceState(state)
          }),

        deserialize: (serialized: ReadonlyArray<FurnaceBlockState>): Effect.Effect<void, never> =>
          Ref.set(stateRef, deserializeFurnaceState(serialized)),

        tick: (deltaTime: DeltaTimeSecs): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            const furnaces = Arr.fromIterable(HashMap.values(state.furnaces))
            const advanced = yield* Effect.forEach(
              furnaces,
              (furnace) => advanceFurnace(furnace, recipeService, inventoryService, deltaTime),
              { concurrency: 1 },
            )
            yield* Ref.set(
              stateRef,
              Arr.reduce(advanced, state, (acc, furnace) => setFurnaceState(acc, furnace)),
            )
          }),
      }
    }),
  },
) {}
