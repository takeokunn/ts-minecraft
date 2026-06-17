import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Either, HashMap, Layer, MutableHashMap, MutableRef, Option, Ref } from 'effect'
import { FurnaceService, FurnaceError } from '@ts-minecraft/inventory'
import { RecipeService, InventoryError } from '@ts-minecraft/inventory'
import { InventoryService } from '@ts-minecraft/inventory'
import { PlayerServicePort, WorldBlockQueryPort } from '@ts-minecraft/world'
import { RecipeId, DeltaTimeSecs } from '@ts-minecraft/core'
import type { InventoryItem } from '@ts-minecraft/core'
import {
  advanceFurnace,
  consumeSmeltingIngredients,
  getAvailableInventoryCounts,
  getFuelBurnDurationSecs,
  validateSmeltingPreconditions,
} from '../application/furnace-service-smelting'
import {
  FURNACE_FUEL_BURN_DURATION_SECS,
  FURNACE_FUEL_ITEMS,
  SMELTING_XP_ITEMS,
  SMELTING_XP_PER_ITEM,
} from '../application/furnace-service.config'
import { calculateSmeltingXp, getSmeltingXpRate } from '../application/furnace-service-xp'
import { emptyFurnaceAtPosition, INITIAL_STATE, setFurnaceState } from '../domain/furnace-service-utils'
import {
  makeChunkManagerService,
  makeFurnaceLayer,
  makeChunkWithFurnace,
  makeInventoryService,
  makePlayerService,
  makeRecipeService,
} from './furnace-service-test-utils'

describe('application/furnace/furnace-service', () => {
  it.effect('collectOutput fails with FurnaceError when no furnace is selected', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      const result = yield* Effect.either(furnace.collectOutput())
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).operation).toBe('collectOutput')
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('collectOutput fails with FurnaceError when furnace has no output', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      const result = yield* Effect.either(furnace.collectOutput())
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect(String((err as FurnaceError).cause)).toContain('No furnace output')
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('collectOutput returns false when inventoryService.addBlock fails with InventoryError', () => {
    const inventoryItems = MutableHashMap.fromIterable<InventoryItem, number>([['RAW_IRON', 1], ['COAL', 1]])
    const customInventory = {
      getAllSlots() {
        return Effect.succeed([
          Option.some({ itemType: 'RAW_IRON' as InventoryItem, count: 1 }),
          Option.some({ itemType: 'COAL' as InventoryItem, count: 1 }),
        ])
      },
      removeBlock(_itemType: InventoryItem, _count: number) {
        return Effect.void
      },
      addBlock(_itemType: InventoryItem, _count: number) {
        return Effect.fail(new InventoryError({ operation: 'addBlock', cause: 'inventory full' }))
      },
    }

    const layer = FurnaceService.Default.pipe(
      Layer.provide(Layer.succeed(RecipeService, makeRecipeService({
        'raw-iron-to-iron-ingot': {
          station: 'furnace',
          ingredients: [{ itemType: 'RAW_IRON', count: 1 }],
          output: { itemType: 'IRON_INGOT', count: 1 },
        },
      }))),
      Layer.provide(Layer.succeed(InventoryService, makeInventoryService(inventoryItems, {
        removeBlock: customInventory.removeBlock,
        addBlock: customInventory.addBlock,
      }))),
      Layer.provide(Layer.succeed(PlayerServicePort, makePlayerService({ x: 0, y: 64, z: 0 }))),
      Layer.provide(Layer.succeed(WorldBlockQueryPort, makeChunkManagerService(makeChunkWithFurnace()))),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      yield* furnace.tick(DeltaTimeSecs.make(10.0))
      const result = yield* furnace.collectOutput()
      expect(result.collected).toBe(false)

      // Safety guarantee: a failed collect (full inventory) must NOT destroy the
      // smelted item — it stays in the furnace output slot so the player can
      // retry after freeing space. (collectOutput adds to inventory first and
      // only clears the slot on success.)
      const state = yield* furnace.getState()
      const preserved = HashMap.get(state.furnaces, '0,64,0')
      expect(Option.isSome(preserved)).toBe(true)
      const output = Option.getOrThrow(preserved).output
      expect(Option.getOrThrow(output).itemType).toBe('IRON_INGOT')
      expect(Option.getOrThrow(output).count).toBe(1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('startSmelting refunds coal when removeBlock for input material fails after coal is removed', () => {
    const coalRemovedRef = MutableRef.make(false)
    const inventoryItems = MutableHashMap.fromIterable<InventoryItem, number>([['RAW_IRON', 1], ['COAL', 1]])
    const refundInventory = {
      getAllSlots() {
        return Effect.succeed([
          Option.some({ itemType: 'RAW_IRON' as InventoryItem, count: 1 }),
          Option.some({ itemType: 'COAL' as InventoryItem, count: 1 }),
        ])
      },
      removeBlock(itemType: InventoryItem, _count: number) {
        return Effect.suspend(() => {
          if (itemType === 'COAL') {
            MutableRef.set(coalRemovedRef, true)
            return Effect.void
          }
          return Effect.fail(new InventoryError({ operation: 'removeBlock', cause: `Insufficient ${itemType}` }))
        })
      },
      addBlock(itemType: InventoryItem, _count: number) {
        return Effect.sync(() => {
          if (itemType === 'COAL' && MutableRef.get(coalRemovedRef)) {
            MutableRef.set(coalRemovedRef, false)
          }
        })
      },
    }

    const layer = FurnaceService.Default.pipe(
      Layer.provide(Layer.succeed(RecipeService, makeRecipeService({
        'raw-iron-to-iron-ingot': {
          station: 'furnace',
          ingredients: [{ itemType: 'RAW_IRON', count: 1 }],
          output: { itemType: 'IRON_INGOT', count: 1 },
        },
      }))),
      Layer.provide(Layer.succeed(InventoryService, makeInventoryService(inventoryItems, {
        removeBlock: refundInventory.removeBlock,
        addBlock: refundInventory.addBlock,
      }))),
      Layer.provide(Layer.succeed(PlayerServicePort, makePlayerService({ x: 0, y: 64, z: 0 }))),
      Layer.provide(Layer.succeed(WorldBlockQueryPort, makeChunkManagerService(makeChunkWithFurnace()))),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect(String((err as FurnaceError).cause)).toContain('Missing input')
      expect(MutableRef.get(coalRemovedRef)).toBe(false)
    }).pipe(Effect.provide(layer))
  })

  it.effect('tick advances progress without completing when deltaTime is less than smelt duration', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      yield* furnace.tick(DeltaTimeSecs.make(0.5))
      const state = yield* furnace.getNearestFurnaceState()
      expect(Option.isSome(state)).toBe(true)
      const s = Option.getOrThrow(state)
      expect(s.progressSecs).toBeCloseTo(0.5)
      expect(Option.isSome(s.activeRecipeId)).toBe(true)
      expect(Option.isNone(s.output)).toBe(true)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('tick does nothing when furnace has no activeRecipeId', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.tick(DeltaTimeSecs.make(1.5))
      const stateAfter = yield* furnace.getNearestFurnaceState()
      expect(Option.isSome(stateAfter)).toBe(true)
      const s = Option.getOrThrow(stateAfter)
      expect(s.progressSecs).toBe(0)
      expect(Option.isNone(s.activeRecipeId)).toBe(true)
      expect(Option.isNone(s.output)).toBe(true)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('tick does not advance progress when furnace state has no activeRecipeId (furnace registered but idle)', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      yield* furnace.tick(DeltaTimeSecs.make(10.0))
      yield* furnace.collectOutput()
      const idleStateBefore = yield* furnace.getNearestFurnaceState()
      const progressBefore = Option.map(idleStateBefore, (s) => s.progressSecs)
      yield* furnace.tick(DeltaTimeSecs.make(1.0))
      const idleStateAfter = yield* furnace.getNearestFurnaceState()
      const progressAfter = Option.map(idleStateAfter, (s) => s.progressSecs)
      expect(progressBefore).toEqual(progressAfter)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  // R61: smelting grants XP on output collection (vanilla Java Edition).
  it.effect('collectOutput returns xp > 0 for XP-granting output (iron ingot = 0.7/item → 1 for count 1)', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      yield* furnace.tick(DeltaTimeSecs.make(10.0))
      const result = yield* furnace.collectOutput()
      expect(result.collected).toBe(true)
      // round(1 * 0.7) = 1, but max(1, 1) = 1
      expect(result.xp).toBe(1)
    }).pipe(Effect.provide(makeFurnaceLayer({
      inventoryItems: MutableHashMap.fromIterable<InventoryItem, number>([['RAW_IRON', 1], ['COAL', 1]]),
    }))),
  )

  it.effect('collectOutput returns xp = 0 for output items with no XP (cooked porkchop)', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-pork-to-cooked-porkchop'))
      yield* furnace.tick(DeltaTimeSecs.make(10.0))
      const result = yield* furnace.collectOutput()
      expect(result.collected).toBe(true)
      expect(result.xp).toBe(0)
    }).pipe(Effect.provide(makeFurnaceLayer({
      inventoryItems: MutableHashMap.fromIterable<InventoryItem, number>([['COOKED_PORKCHOP', 1], ['COAL', 1]]),
      recipeMap: {
        'raw-pork-to-cooked-porkchop': {
          station: 'furnace',
          ingredients: [{ itemType: 'COOKED_PORKCHOP', count: 1 }],
          output: { itemType: 'COOKED_PORKCHOP', count: 1 },
        },
      },
    }))),
  )

  it('returns configured burn duration for every furnace fuel item', () => {
    for (const fuel of FURNACE_FUEL_ITEMS) {
      expect(getFuelBurnDurationSecs(fuel)).toBe(FURNACE_FUEL_BURN_DURATION_SECS[fuel])
      expect(getFuelBurnDurationSecs(fuel)).toBeGreaterThan(0)
    }
  })

  it('returns configured XP rate for every smelting XP item', () => {
    for (const item of SMELTING_XP_ITEMS) {
      const rate = Option.getOrThrow(getSmeltingXpRate(item))
      expect(rate).toBe(SMELTING_XP_PER_ITEM[item])
      expect(rate).toBeGreaterThan(0)
    }
  })

  it('calculates whole-number smelting XP at the collection boundary', () => {
    expect(calculateSmeltingXp({ itemType: 'IRON_INGOT', count: 1 })).toBe(1)
    expect(calculateSmeltingXp({ itemType: 'IRON_INGOT', count: 3 })).toBe(2)
    expect(calculateSmeltingXp({ itemType: 'COOKED_PORKCHOP', count: 1 })).toBe(0)
    expect(calculateSmeltingXp({ itemType: 'IRON_INGOT', count: 0 })).toBe(0)
  })

  it.effect('getAvailableInventoryCounts ignores empty and non-positive slots', () =>
    Effect.gen(function* () {
      const inventoryService = InventoryService.of({
        _tag: '@minecraft/application/InventoryService' as const,
        getAllSlots: () => Effect.succeed([
          Option.none(),
          Option.some({ itemType: 'STONE' as InventoryItem, count: 0 }),
          Option.some({ itemType: 'STONE' as InventoryItem, count: -1 }),
          Option.some({ itemType: 'STONE' as InventoryItem, count: 2 }),
          Option.some({ itemType: 'DIRT' as InventoryItem, count: 3 }),
        ]),
        removeBlock: () => Effect.void,
        addBlock: () => Effect.void,
        getSlot: () => Effect.succeed(Option.none()),
        setSlot: () => Effect.void,
        damageSlot: () => Effect.void,
        repairMendingItemsWithXP: (amount) => Effect.succeed(amount),
        moveStack: () => Effect.void,
        quickMove: () => Effect.void,
        getHotbarSlots: () => Effect.succeed([]),
        clear: () => Effect.void,
        serialize: () => Effect.succeed([]),
        deserialize: () => Effect.void,
      })

      const counts = yield* getAvailableInventoryCounts(inventoryService)

      expect(Option.getOrElse(HashMap.get(counts, 'STONE' as InventoryItem), () => 0)).toBe(2)
      expect(Option.getOrElse(HashMap.get(counts, 'DIRT' as InventoryItem), () => 0)).toBe(3)
      expect(Option.isNone(HashMap.get(counts, 'COAL' as InventoryItem))).toBe(true)
    }),
  )

  it.effect('validateSmeltingPreconditions reuses existing burn without requiring fuel', () =>
    Effect.gen(function* () {
      const position = { x: 0, y: 64, z: 0 }
      const furnace = {
        ...emptyFurnaceAtPosition(position),
        burnRemainingSecs: 3,
        burnTotalSecs: 80,
      }
      const stateRef = yield* Ref.make(setFurnaceState({
        ...INITIAL_STATE,
        selectedFurnacePosition: Option.some(position),
      }, furnace))
      const recipeService = makeRecipeService({
        'raw-iron-to-iron-ingot': {
          station: 'furnace',
          ingredients: [{ itemType: 'RAW_IRON' as InventoryItem, count: 1 }],
          output: { itemType: 'IRON_INGOT' as InventoryItem, count: 1 },
        },
      })
      const helpers = {
        getSelectedFurnacePosition: () => Effect.succeed(Option.some(position)),
      }
      const available = HashMap.set(
        HashMap.empty<InventoryItem, number>(),
        'RAW_IRON' as InventoryItem,
        1,
      )

      const result = yield* validateSmeltingPreconditions(
        recipeService,
        helpers,
        stateRef,
        RecipeId.make('raw-iron-to-iron-ingot'),
        available,
      )

      expect(result.burnRemainingSecs).toBe(3)
      expect(Option.isNone(result.fuel)).toBe(true)
    }),
  )

  it.effect('consumeSmeltingIngredients does not refund fuel when no fuel was consumed', () =>
    Effect.gen(function* () {
      const addBlockCalled = MutableRef.make(false)
      const inventoryService = InventoryService.of({
        _tag: '@minecraft/application/InventoryService' as const,
        getAllSlots: () => Effect.succeed([]),
        removeBlock: () =>
          Effect.fail(new InventoryError({ operation: 'removeBlock', cause: 'missing input' })),
        addBlock: () =>
          Effect.sync(() => {
            MutableRef.set(addBlockCalled, true)
          }),
        getSlot: () => Effect.succeed(Option.none()),
        setSlot: () => Effect.void,
        damageSlot: () => Effect.void,
        repairMendingItemsWithXP: (amount) => Effect.succeed(amount),
        moveStack: () => Effect.void,
        quickMove: () => Effect.void,
        getHotbarSlots: () => Effect.succeed([]),
        clear: () => Effect.void,
        serialize: () => Effect.succeed([]),
        deserialize: () => Effect.void,
      })

      const result = yield* Effect.either(consumeSmeltingIngredients(
        inventoryService,
        { itemType: 'RAW_IRON' as InventoryItem, count: 1 },
        Option.none(),
      ))

      expect(Either.isLeft(result)).toBe(true)
      expect(MutableRef.get(addBlockCalled)).toBe(false)
    }),
  )

  it.effect('advanceFurnace stalls when reported fuel cannot be removed', () =>
    Effect.gen(function* () {
      const inventoryService = makeInventoryService(
        MutableHashMap.fromIterable<InventoryItem, number>([['COAL', 1]]),
        {
          removeBlock: () =>
            Effect.fail(new InventoryError({ operation: 'removeBlock', cause: 'fuel already gone' })),
        },
      )
      const recipeService = makeRecipeService({
        'raw-iron-to-iron-ingot': {
          station: 'furnace',
          ingredients: [{ itemType: 'RAW_IRON' as InventoryItem, count: 1 }],
          output: { itemType: 'IRON_INGOT' as InventoryItem, count: 1 },
        },
      })
      const furnace = {
        ...emptyFurnaceAtPosition({ x: 0, y: 64, z: 0 }),
        activeRecipeId: Option.some(RecipeId.make('raw-iron-to-iron-ingot')),
      }

      const next = yield* advanceFurnace(furnace, recipeService, inventoryService, DeltaTimeSecs.make(1))

      expect(next.progressSecs).toBe(0)
      expect(next.burnRemainingSecs).toBe(0)
      expect(Option.isNone(next.fuel)).toBe(true)
    }),
  )

  it.effect('advanceFurnace consumes fresh fuel before advancing incomplete progress', () =>
    Effect.gen(function* () {
      const inventoryItems = MutableHashMap.fromIterable<InventoryItem, number>([['COAL', 1]])
      const inventoryService = makeInventoryService(inventoryItems)
      const recipeService = makeRecipeService({
        'raw-iron-to-iron-ingot': {
          station: 'furnace',
          ingredients: [{ itemType: 'RAW_IRON' as InventoryItem, count: 1 }],
          output: { itemType: 'IRON_INGOT' as InventoryItem, count: 1 },
        },
      })
      const furnace = {
        ...emptyFurnaceAtPosition({ x: 0, y: 64, z: 0 }),
        activeRecipeId: Option.some(RecipeId.make('raw-iron-to-iron-ingot')),
      }

      const next = yield* advanceFurnace(furnace, recipeService, inventoryService, DeltaTimeSecs.make(0.5))

      expect(next.progressSecs).toBe(0.5)
      expect(next.burnRemainingSecs).toBe(79.5)
      expect(next.burnTotalSecs).toBe(80)
      expect(Option.getOrThrow(next.fuel).itemType).toBe('COAL')
      expect(Option.getOrElse(MutableHashMap.get(inventoryItems, 'COAL' as InventoryItem), () => 0)).toBe(0)
    }),
  )

  it.effect('advanceFurnace preserves incomplete progress without an active fuel item', () =>
    Effect.gen(function* () {
      const inventoryService = makeInventoryService(MutableHashMap.empty<InventoryItem, number>())
      const recipeService = makeRecipeService({
        'raw-iron-to-iron-ingot': {
          station: 'furnace',
          ingredients: [{ itemType: 'RAW_IRON' as InventoryItem, count: 1 }],
          output: { itemType: 'IRON_INGOT' as InventoryItem, count: 1 },
        },
      })
      const furnace = {
        ...emptyFurnaceAtPosition({ x: 0, y: 64, z: 0 }),
        activeRecipeId: Option.some(RecipeId.make('raw-iron-to-iron-ingot')),
        progressSecs: 1,
        burnRemainingSecs: 0.5,
        burnTotalSecs: 80,
      }

      const next = yield* advanceFurnace(furnace, recipeService, inventoryService, DeltaTimeSecs.make(0.25))

      expect(next.progressSecs).toBe(1.25)
      expect(next.burnRemainingSecs).toBe(0.25)
      expect(Option.isNone(next.fuel)).toBe(true)
    }),
  )

  it.effect('advanceFurnace waits when no replacement fuel is available', () =>
    Effect.gen(function* () {
      const inventoryService = makeInventoryService(MutableHashMap.empty<InventoryItem, number>())
      const recipeService = makeRecipeService({
        'raw-iron-to-iron-ingot': {
          station: 'furnace',
          ingredients: [{ itemType: 'RAW_IRON' as InventoryItem, count: 1 }],
          output: { itemType: 'IRON_INGOT' as InventoryItem, count: 1 },
        },
      })
      const furnace = {
        ...emptyFurnaceAtPosition({ x: 0, y: 64, z: 0 }),
        activeRecipeId: Option.some(RecipeId.make('raw-iron-to-iron-ingot')),
        progressSecs: 2,
      }

      const next = yield* advanceFurnace(furnace, recipeService, inventoryService, DeltaTimeSecs.make(1))

      expect(next.progressSecs).toBe(2)
      expect(next.burnRemainingSecs).toBe(0)
      expect(Option.isNone(next.fuel)).toBe(true)
    }),
  )
})
