import { describe,it } from '@effect/vitest'
import { InventoryService,InventoryServiceLive,RecipeService } from '@ts-minecraft/inventory'
import type { InventoryItem } from '@ts-minecraft/kernel'
import { RecipeId } from '@ts-minecraft/kernel'
import { BlockRegistry } from '@ts-minecraft/world-state'
import { Array as Arr,Effect,HashMap,Layer,Option } from 'effect'
import { expect } from 'vitest'
import { createTestBlockRegistry } from './inventory-service-test-utils'

const registryLayer = Layer.succeed(BlockRegistry, createTestBlockRegistry())

const inventoryLayer = InventoryServiceLive.pipe(Layer.provide(registryLayer))
const testLayer = Layer.mergeAll(RecipeService.Default, inventoryLayer)

const countBlock = (slots: ReadonlyArray<Option.Option<{ readonly itemType: InventoryItem; readonly count: number }>>, itemType: InventoryItem): number =>
  Arr.reduce(slots, 0, (sum, slot) =>
    sum + Option.match(slot, {
      onNone: () => 0,
      onSome: (item) => item.itemType === itemType ? item.count : 0,
    }),
  )

describe('application/crafting/recipe-service', () => {
  it.effect('defines a minimally Minecraft-like progression recipe set', () =>
    Effect.gen(function* () {
      const recipes = (yield* RecipeService).getAllRecipes()
      const ids = Arr.map(recipes, (recipe) => recipe.id)
      // Core tool/block progression
      expect(ids).toContain('wood-to-planks')
      expect(ids).toContain('planks-to-sticks')
      expect(ids).toContain('planks-to-crafting-table')
      expect(ids).toContain('cobblestone-to-furnace')
      expect(ids).toContain('planks-and-sticks-to-wooden-sword')
      expect(ids).toContain('diamonds-and-sticks-to-diamond-pickaxe')
      // Armor recipes (added with Phase 12 equipment system)
      expect(ids).toContain('leather-to-leather-helmet')
      expect(ids).toContain('iron-ingot-to-iron-chestplate')
      expect(ids).toContain('diamond-to-diamond-boots')
      expect(recipes.length).toBeGreaterThanOrEqual(17)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('findById returns the wood-to-planks recipe with PLANKS output', () =>
    Effect.gen(function* () {
      const recipe = (yield* RecipeService).findById(RecipeId.make('wood-to-planks'))
      expect(Option.isSome(recipe)).toBe(true)
      const unwrapped = Option.getOrThrow(recipe)
      expect(unwrapped.output.itemType).toBe('PLANKS')
      expect(unwrapped.output.count).toBe(4)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('findCraftable returns progression recipes only when ingredients are sufficient', () =>
    Effect.gen(function* () {
      const service = yield* RecipeService
      const craftableWithWood = service.findCraftable(HashMap.make(['WOOD' as InventoryItem, 1]))
      const craftableWithPlanks = service.findCraftable(HashMap.make(['PLANKS' as InventoryItem, 4]))
      const craftableWithSwordParts = service.findCraftable(HashMap.make(['PLANKS' as InventoryItem, 2], ['STICKS' as InventoryItem, 1], ['CRAFTING_TABLE' as InventoryItem, 1]))
      const craftableWithPickaxeParts = service.findCraftable(HashMap.make(['PLANKS' as InventoryItem, 3], ['STICKS' as InventoryItem, 2], ['CRAFTING_TABLE' as InventoryItem, 1]))
      const craftableWithStoneParts = service.findCraftable(HashMap.make(['COBBLESTONE' as InventoryItem, 3], ['STICKS' as InventoryItem, 2], ['CRAFTING_TABLE' as InventoryItem, 1]))
      const craftableWithDiamondParts = service.findCraftable(HashMap.make(['DIAMOND' as InventoryItem, 3], ['STICKS' as InventoryItem, 2], ['CRAFTING_TABLE' as InventoryItem, 1]))

      expect(Arr.map(craftableWithWood, (recipe) => recipe.id)).toContain('wood-to-planks')
      expect(Arr.map(craftableWithPlanks, (recipe) => recipe.id)).toContain('planks-to-sticks')
      expect(Arr.map(craftableWithPlanks, (recipe) => recipe.id)).toContain('planks-to-crafting-table')
      expect(Arr.map(craftableWithSwordParts, (recipe) => recipe.id)).toContain('planks-and-sticks-to-wooden-sword')
      expect(Arr.map(craftableWithPickaxeParts, (recipe) => recipe.id)).toContain('planks-and-sticks-to-wooden-pickaxe')
      expect(Arr.map(craftableWithStoneParts, (recipe) => recipe.id)).toContain('cobblestone-and-sticks-to-stone-pickaxe')
      expect(Arr.map(craftableWithDiamondParts, (recipe) => recipe.id)).toContain('diamonds-and-sticks-to-diamond-pickaxe')
      expect(Arr.map(craftableWithPlanks, (recipe) => recipe.id)).not.toContain('coal-and-stick-to-torches')
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft turns wood into planks', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('WOOD', 1)

      yield* rs.craft(RecipeId.make('wood-to-planks'), inv)

      const slotsAfter = yield* inv.getAllSlots()
      expect(countBlock(slotsAfter, 'WOOD')).toBe(0)
      expect(countBlock(slotsAfter, 'PLANKS')).toBe(4)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft consumes only the recipe ingredient count, leaving surplus untouched', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      // wood-to-planks needs 1 WOOD. With 10 in stock, a craft must take exactly
      // 1 (not the whole stack), leaving 9 — the core exact-consumption property,
      // isolated from any multi-recipe chain.
      yield* inv.addBlock('WOOD', 10)

      yield* rs.craft(RecipeId.make('wood-to-planks'), inv)

      const slotsAfter = yield* inv.getAllSlots()
      expect(countBlock(slotsAfter, 'WOOD')).toBe(9)
      expect(countBlock(slotsAfter, 'PLANKS')).toBe(4)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft supports a basic wood progression chain into sticks, crafting table, and wooden sword', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('WOOD', 3)

      yield* rs.craft(RecipeId.make('wood-to-planks'), inv)
      yield* rs.craft(RecipeId.make('wood-to-planks'), inv)
      yield* rs.craft(RecipeId.make('wood-to-planks'), inv)
      yield* rs.craft(RecipeId.make('planks-to-sticks'), inv)
      yield* rs.craft(RecipeId.make('planks-to-crafting-table'), inv)
      yield* rs.craft(RecipeId.make('planks-and-sticks-to-wooden-sword'), inv)

      const slotsAfter = yield* inv.getAllSlots()
      expect(countBlock(slotsAfter, 'PLANKS')).toBe(4)
      expect(countBlock(slotsAfter, 'STICKS')).toBe(3)
      expect(countBlock(slotsAfter, 'CRAFTING_TABLE')).toBe(1)
      expect(countBlock(slotsAfter, 'WOODEN_SWORD')).toBe(1)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft supports a pickaxe progression chain from wood to stone', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('WOOD', 3)
      yield* inv.addBlock('COBBLESTONE', 3)

      yield* rs.craft(RecipeId.make('wood-to-planks'), inv)
      yield* rs.craft(RecipeId.make('wood-to-planks'), inv)
      yield* rs.craft(RecipeId.make('wood-to-planks'), inv)
      yield* rs.craft(RecipeId.make('planks-to-sticks'), inv)
      yield* rs.craft(RecipeId.make('planks-to-crafting-table'), inv)
      yield* rs.craft(RecipeId.make('planks-and-sticks-to-wooden-pickaxe'), inv)
      yield* rs.craft(RecipeId.make('cobblestone-and-sticks-to-stone-pickaxe'), inv)

      const slotsAfter = yield* inv.getAllSlots()
      expect(countBlock(slotsAfter, 'WOODEN_PICKAXE')).toBe(1)
      expect(countBlock(slotsAfter, 'STONE_PICKAXE')).toBe(1)
      expect(countBlock(slotsAfter, 'COBBLESTONE')).toBe(0)
      expect(countBlock(slotsAfter, 'STICKS')).toBe(0)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('findCraftable returns stone/iron/diamond sword recipes when ingredients are sufficient', () =>
    Effect.gen(function* () {
      const service = yield* RecipeService
      const craftableWithStoneSwordParts = service.findCraftable(HashMap.make(['COBBLESTONE' as InventoryItem, 2], ['STICKS' as InventoryItem, 1], ['CRAFTING_TABLE' as InventoryItem, 1]))
      const craftableWithIronSwordParts = service.findCraftable(HashMap.make(['IRON_INGOT' as InventoryItem, 2], ['STICKS' as InventoryItem, 1], ['CRAFTING_TABLE' as InventoryItem, 1]))
      const craftableWithDiamondSwordParts = service.findCraftable(HashMap.make(['DIAMOND' as InventoryItem, 2], ['STICKS' as InventoryItem, 1], ['CRAFTING_TABLE' as InventoryItem, 1]))

      expect(Arr.map(craftableWithStoneSwordParts, (recipe) => recipe.id)).toContain('cobblestone-and-sticks-to-stone-sword')
      expect(Arr.map(craftableWithIronSwordParts, (recipe) => recipe.id)).toContain('iron-ingots-and-sticks-to-iron-sword')
      expect(Arr.map(craftableWithDiamondSwordParts, (recipe) => recipe.id)).toContain('diamonds-and-sticks-to-diamond-sword')
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft produces a stone sword from cobblestone and sticks', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('COBBLESTONE', 2)
      yield* inv.addBlock('STICKS', 1)
      yield* inv.addBlock('CRAFTING_TABLE', 1)

      yield* rs.craft(RecipeId.make('cobblestone-and-sticks-to-stone-sword'), inv)

      const slotsAfter = yield* inv.getAllSlots()
      expect(countBlock(slotsAfter, 'COBBLESTONE')).toBe(0)
      expect(countBlock(slotsAfter, 'STICKS')).toBe(0)
      expect(countBlock(slotsAfter, 'STONE_SWORD')).toBe(1)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft produces an iron sword from iron ingots and sticks', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('IRON_INGOT', 2)
      yield* inv.addBlock('STICKS', 1)
      yield* inv.addBlock('CRAFTING_TABLE', 1)

      yield* rs.craft(RecipeId.make('iron-ingots-and-sticks-to-iron-sword'), inv)

      const slotsAfter = yield* inv.getAllSlots()
      expect(countBlock(slotsAfter, 'IRON_INGOT')).toBe(0)
      expect(countBlock(slotsAfter, 'STICKS')).toBe(0)
      expect(countBlock(slotsAfter, 'IRON_SWORD')).toBe(1)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft produces a diamond sword from diamonds and sticks', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('DIAMOND', 2)
      yield* inv.addBlock('STICKS', 1)
      yield* inv.addBlock('CRAFTING_TABLE', 1)

      yield* rs.craft(RecipeId.make('diamonds-and-sticks-to-diamond-sword'), inv)

      const slotsAfter = yield* inv.getAllSlots()
      expect(countBlock(slotsAfter, 'DIAMOND')).toBe(0)
      expect(countBlock(slotsAfter, 'STICKS')).toBe(0)
      expect(countBlock(slotsAfter, 'DIAMOND_SWORD')).toBe(1)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('craft produces a furnace from cobblestone', () =>
    Effect.gen(function* () {
      const rs = yield* RecipeService
      const inv = yield* InventoryService
      yield* inv.addBlock('COBBLESTONE', 8)
      yield* inv.addBlock('CRAFTING_TABLE', 1)

      yield* rs.craft(RecipeId.make('cobblestone-to-furnace'), inv)

      const slotsAfter = yield* inv.getAllSlots()
      expect(countBlock(slotsAfter, 'COBBLESTONE')).toBe(0)
      expect(countBlock(slotsAfter, 'FURNACE')).toBe(1)
    }).pipe(Effect.provide(testLayer))
  )
})
