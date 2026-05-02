import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, HashMap, Layer, Option } from 'effect'
import type { Block, BlockType } from '@ts-minecraft/domain'
import { BlockRegistry } from '@ts-minecraft/domain'
import { RecipeService } from '@ts-minecraft/crafting-system'
import { InventoryService, InventoryServiceLive } from '@ts-minecraft/inventory-system'
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

      expect(result._tag).toBe('Left')
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

      expect(result._tag).toBe('Left')
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

      expect(result._tag).toBe('Left')
      expect(countBlock(before, 'PLANKS')).toBe(countBlock(after, 'PLANKS'))
      expect(countBlock(after, 'STICKS')).toBe(0)
    }).pipe(Effect.provide(testLayer))
  )
})
