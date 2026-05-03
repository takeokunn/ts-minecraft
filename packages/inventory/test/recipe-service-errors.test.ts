import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Either, HashMap, Layer, Option } from 'effect'
import type { BlockType } from '@ts-minecraft/kernel'
import { RecipeService } from '@ts-minecraft/inventory'
import { InventoryService, InventoryServiceLive } from '@ts-minecraft/inventory'
import { RecipeId } from '@ts-minecraft/kernel'
import { BlockRegistry } from '@ts-minecraft/world-state'
import { createTestBlockRegistry } from './inventory-service-test-utils'

const registryLayer = Layer.succeed(BlockRegistry, createTestBlockRegistry())

const inventoryLayer = InventoryServiceLive.pipe(Layer.provide(registryLayer))
const testLayer = Layer.mergeAll(RecipeService.Default, inventoryLayer)

const countBlock = (slots: ReadonlyArray<Option.Option<{ readonly blockType: BlockType; readonly count: number }>>, blockType: BlockType): number =>
  Arr.reduce(slots, 0, (sum, slot) =>
    sum + Option.match(slot, {
      onNone: () => 0,
      onSome: (item) => item.blockType === blockType ? item.count : 0,
    }),
  )

describe('application/crafting/recipe-service — access control and errors', () => {
  it.effect('findCraftable does not expose crafting-table recipes without nearby table access', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const available = HashMap.make(
        ['PLANKS' as BlockType, 2],
        ['STICKS' as BlockType, 1],
        ['CRAFTING_TABLE' as BlockType, 1],
      )

      const craftableWithoutTable = rs.findCraftable(available, false)
      const craftableWithTable = rs.findCraftable(available, true)

      expect(Arr.map(craftableWithoutTable, (recipe) => recipe.id)).not.toContain('planks-and-sticks-to-wooden-sword')
      expect(Arr.map(craftableWithTable, (recipe) => recipe.id)).toContain('planks-and-sticks-to-wooden-sword')
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft rejects crafting-table recipes when nearby table access is false even if inventory contains a table item', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('PLANKS', 2)
      yield* inv.addBlock('STICKS', 1)
      yield* inv.addBlock('CRAFTING_TABLE', 1)

      const result = yield* rs.craft(RecipeId.make('planks-and-sticks-to-wooden-sword'), inv, false).pipe(Effect.either)
      const slotsAfter = yield* inv.getAllSlots()

      expect(Either.isLeft(result)).toBe(true)
      expect(countBlock(slotsAfter, 'WOODEN_SWORD')).toBe(0)
      expect(countBlock(slotsAfter, 'PLANKS')).toBe(2)
      expect(countBlock(slotsAfter, 'STICKS')).toBe(1)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft rejects wooden-pickaxe recipe without nearby crafting table access', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('PLANKS', 3)
      yield* inv.addBlock('STICKS', 2)
      yield* inv.addBlock('CRAFTING_TABLE', 1)

      const result = yield* rs.craft(RecipeId.make('planks-and-sticks-to-wooden-pickaxe'), inv, false).pipe(Effect.either)
      const slotsAfter = yield* inv.getAllSlots()

      expect(Either.isLeft(result)).toBe(true)
      expect(countBlock(slotsAfter, 'WOODEN_PICKAXE')).toBe(0)
      expect(countBlock(slotsAfter, 'PLANKS')).toBe(3)
      expect(countBlock(slotsAfter, 'STICKS')).toBe(2)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft produces torches from coal ore and sticks', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('COAL', 1)
      yield* inv.addBlock('STICKS', 1)

      yield* rs.craft(RecipeId.make('coal-and-stick-to-torches'), inv)

      const slotsAfter = yield* inv.getAllSlots()
      expect(countBlock(slotsAfter, 'COAL')).toBe(0)
      expect(countBlock(slotsAfter, 'STICKS')).toBe(0)
      expect(countBlock(slotsAfter, 'TORCH')).toBe(4)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft produces a diamond pickaxe from diamonds and sticks', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('DIAMOND', 3)
      yield* inv.addBlock('STICKS', 2)
      yield* inv.addBlock('CRAFTING_TABLE', 1)

      yield* rs.craft(RecipeId.make('diamonds-and-sticks-to-diamond-pickaxe'), inv)

      const slotsAfter = yield* inv.getAllSlots()
      expect(countBlock(slotsAfter, 'DIAMOND')).toBe(0)
      expect(countBlock(slotsAfter, 'STICKS')).toBe(0)
      expect(countBlock(slotsAfter, 'DIAMOND_PICKAXE')).toBe(1)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft produces a wooden sword from planks and sticks', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('PLANKS', 2)
      yield* inv.addBlock('STICKS', 1)
      yield* inv.addBlock('CRAFTING_TABLE', 1)

      yield* rs.craft(RecipeId.make('planks-and-sticks-to-wooden-sword'), inv)

      const slotsAfter = yield* inv.getAllSlots()
      expect(countBlock(slotsAfter, 'PLANKS')).toBe(0)
      expect(countBlock(slotsAfter, 'STICKS')).toBe(0)
      expect(countBlock(slotsAfter, 'WOODEN_SWORD')).toBe(1)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft fails without enough ingredients and leaves inventory unchanged', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('PLANKS', 1)

      const before = yield* inv.getAllSlots()
      const result = yield* rs.craft(RecipeId.make('planks-to-sticks'), inv).pipe(Effect.either)
      const after = yield* inv.getAllSlots()

      expect(Either.isLeft(result)).toBe(true)
      expect(countBlock(before, 'PLANKS')).toBe(countBlock(after, 'PLANKS'))
      expect(countBlock(after, 'STICKS')).toBe(0)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft fails when crafting_table recipe is attempted without table access', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('COBBLESTONE', 8)

      const result = yield* rs.craft(
        RecipeId.make('cobblestone-to-furnace'),
        inv,
        false,  // hasCraftingTableAccess = false
      ).pipe(Effect.either)

      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.cause).toContain('requires a crafting table')
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft fails when furnace recipe is attempted without furnace access', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('RAW_IRON', 1)
      yield* inv.addBlock('FURNACE', 1)

      const result = yield* rs.craft(
        RecipeId.make('raw-iron-to-iron-ingot'),
        inv,
        true,   // hasCraftingTableAccess = true
        false,  // hasFurnaceAccess = false
      ).pipe(Effect.either)

      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.cause).toContain('requires a furnace')
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft fails with RecipeError when removeBlock returns false (inventory inconsistency)', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService

      const fakeInv = InventoryService.of({
        _tag: '@minecraft/application/InventoryService' as const,
        getAllSlots: () => Effect.succeed(
          [Option.some({ blockType: 'WOOD' as const, count: 1 }), ...Arr.makeBy(35, () => Option.none())]
        ),
        removeBlock: (_blockType: unknown, _count: unknown) => Effect.succeed(false),
        addBlock: (_blockType: unknown, _count: unknown) => Effect.succeed(true),
        getSlot: (_idx: unknown) => Effect.succeed(Option.none()),
        setSlot: (_idx: unknown, _slot: unknown) => Effect.void,
        moveStack: (_from: unknown, _to: unknown) => Effect.void,
        getHotbarSlots: () => Effect.succeed([]),
        clear: () => Effect.void,
        serialize: () => Effect.succeed({ slots: [] }),
        deserialize: (_data: unknown) => Effect.void,
      })

      const result = yield* rs.craft(RecipeId.make('wood-to-planks'), fakeInv).pipe(Effect.either)

      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('RecipeError')
      expect(err.cause).toContain('Failed to remove')
      expect(err.cause).toContain('WOOD')
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft with a nonexistent recipe ID fails with RecipeError (onNone path)', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService

      const result = yield* rs.craft(RecipeId.make('nonexistent-recipe'), inv).pipe(Effect.either)

      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('RecipeError')
      expect(err.cause).toContain('nonexistent-recipe')
    }).pipe(Effect.provide(testLayer))
  )
})
