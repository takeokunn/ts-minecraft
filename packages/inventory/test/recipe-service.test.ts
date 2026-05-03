import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Either, HashMap, Layer, Option } from 'effect'
import type { BlockType } from '@ts-minecraft/kernel'
import type { Block } from '@ts-minecraft/world-state'
import { BlockRegistry } from '@ts-minecraft/world-state'
import { RecipeService } from '@ts-minecraft/inventory'
import { InventoryService, InventoryServiceLive } from '@ts-minecraft/inventory'
import { RecipeId } from '@ts-minecraft/kernel'

const registryLayer = Layer.succeed(BlockRegistry, {
  register: (_block: Block) => Effect.void,
  get: (_blockType: BlockType) => Effect.succeed(Option.none<Block>()),
  getAll: () => Effect.succeed([] as Block[]),
  dispose: () => Effect.void,
} as unknown as BlockRegistry)

const inventoryLayer = InventoryServiceLive.pipe(Layer.provide(registryLayer))
const testLayer = Layer.mergeAll(RecipeService.Default, inventoryLayer)

const countBlock = (slots: ReadonlyArray<Option.Option<{ readonly blockType: BlockType; readonly count: number }>>, blockType: BlockType): number =>
  Arr.reduce(slots, 0, (sum, slot) =>
    sum + Option.match(slot, {
      onNone: () => 0,
      onSome: (item) => item.blockType === blockType ? item.count : 0,
    }),
  )

describe('application/crafting/recipe-service', () => {
  it.effect('defines a minimally Minecraft-like progression recipe set', () =>
    Effect.gen(function* () {
      const recipes = (yield* RecipeService).getAllRecipes()
      const ids = Arr.map(recipes, (recipe) => recipe.id)
      expect(ids).toEqual([
        'wood-to-planks',
        'planks-to-sticks',
        'planks-to-crafting-table',
        'cobblestone-to-furnace',
        'coal-and-stick-to-torches',
        'planks-and-sticks-to-wooden-sword',
        'planks-and-sticks-to-wooden-pickaxe',
        'cobblestone-and-sticks-to-stone-pickaxe',
        'raw-iron-to-iron-ingot',
        'iron-ingots-and-sticks-to-iron-pickaxe',
        'raw-gold-to-gold-ingot',
        'diamonds-and-sticks-to-diamond-pickaxe',
      ])
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('findById returns the wood-to-planks recipe with PLANKS output', () =>
    Effect.gen(function* () {
      const recipe = (yield* RecipeService).findById(RecipeId.make('wood-to-planks'))
      expect(Option.isSome(recipe)).toBe(true)
      const unwrapped = Option.getOrThrow(recipe)
      expect(unwrapped.output.blockType).toBe('PLANKS')
      expect(unwrapped.output.count).toBe(4)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('findCraftable returns progression recipes only when ingredients are sufficient', () =>
    Effect.gen(function* () {
      const service = yield* RecipeService
      const craftableWithWood = service.findCraftable(HashMap.make(['WOOD' as BlockType, 1]))
      const craftableWithPlanks = service.findCraftable(HashMap.make(['PLANKS' as BlockType, 4]))
      const craftableWithSwordParts = service.findCraftable(HashMap.make(['PLANKS' as BlockType, 2], ['STICKS' as BlockType, 1], ['CRAFTING_TABLE' as BlockType, 1]))
      const craftableWithPickaxeParts = service.findCraftable(HashMap.make(['PLANKS' as BlockType, 3], ['STICKS' as BlockType, 2], ['CRAFTING_TABLE' as BlockType, 1]))
      const craftableWithStoneParts = service.findCraftable(HashMap.make(['COBBLESTONE' as BlockType, 3], ['STICKS' as BlockType, 2], ['CRAFTING_TABLE' as BlockType, 1]))
      const craftableWithDiamondParts = service.findCraftable(HashMap.make(['DIAMOND' as BlockType, 3], ['STICKS' as BlockType, 2], ['CRAFTING_TABLE' as BlockType, 1]))

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
