import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Either, HashMap, HashSet, Layer, Option } from 'effect'
import type { Block, BlockType } from '@/domain/block'
import { BlockRegistry } from '@/domain/block-registry'
import { RecipeService } from '@/application/crafting/recipe-service'
import { InventoryService, InventoryServiceLive } from '@/application/inventory/inventory-service'
import { RecipeId } from '@/shared/kernel'

describe('application/crafting/recipe-service', () => {
  describe('getAllRecipes', () => {
    it.effect('returns at least 5 recipes', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const recipes = rs.getAllRecipes()
        expect(recipes.length).toBeGreaterThanOrEqual(5)
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('every recipe has a non-empty id', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const recipes = rs.getAllRecipes()
        Arr.forEach(recipes, (recipe) => {
          expect(recipe.id.length).toBeGreaterThan(0)
        })
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('every recipe has at least one ingredient', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const recipes = rs.getAllRecipes()
        Arr.forEach(recipes, (recipe) => {
          expect(recipe.ingredients.length).toBeGreaterThanOrEqual(1)
        })
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('every ingredient has count between 1 and 64', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const recipes = rs.getAllRecipes()
        Arr.forEach(recipes, (recipe) => {
          Arr.forEach(recipe.ingredients, (ing) => {
            expect(ing.count).toBeGreaterThanOrEqual(1)
            expect(ing.count).toBeLessThanOrEqual(64)
          })
        })
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('every output has count between 1 and 64', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const recipes = rs.getAllRecipes()
        Arr.forEach(recipes, (recipe) => {
          expect(recipe.output.count).toBeGreaterThanOrEqual(1)
          expect(recipe.output.count).toBeLessThanOrEqual(64)
        })
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('all recipe ids are unique', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const recipes = rs.getAllRecipes()
        const ids = Arr.map(recipes, (r) => r.id)
        const uniqueIds = HashSet.fromIterable(ids)
        expect(HashSet.size(uniqueIds)).toBe(ids.length)
      }).pipe(Effect.provide(RecipeService.Default))
    )
  })

  describe('findById', () => {
    it.effect('returns the recipe for a known id', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const result = rs.findById(RecipeId.make('wood-to-planks'))
        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrThrow(result).id).toBe(RecipeId.make('wood-to-planks'))
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('returns None for an unknown id', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const result = rs.findById(RecipeId.make('does-not-exist'))
        expect(Option.isNone(result)).toBe(true)
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('returns the grass-to-dirt recipe with correct output', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const result = rs.findById(RecipeId.make('grass-to-dirt'))
        expect(Option.isSome(result)).toBe(true)
        const unwrapped = Option.getOrThrow(result)
        expect(unwrapped.output.blockType).toBe('DIRT')
        expect(unwrapped.output.count).toBe(1)
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('returns the stone-to-cobblestone recipe with correct ingredient', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const result = rs.findById(RecipeId.make('stone-to-cobblestone'))
        expect(Option.isSome(result)).toBe(true)
        const unwrapped = Option.getOrThrow(result)
        expect(Option.getOrThrow(Arr.get(unwrapped.ingredients, 0)).blockType).toBe('STONE')
        expect(unwrapped.output.blockType).toBe('COBBLESTONE')
      }).pipe(Effect.provide(RecipeService.Default))
    )
  })

  describe('findCraftable', () => {
    it.effect('returns matching recipes when inventory has sufficient ingredients', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const available = HashMap.make(['WOOD' as BlockType, 5])
        const craftable = rs.findCraftable(available)
        const ids = Arr.map(craftable, (r) => r.id)
        expect(ids).toContain('wood-to-planks')
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('excludes recipes when ingredients are insufficient', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        // sand-and-gravel-to-dirt needs SAND:1 and GRAVEL:1 — provide only SAND
        const available = HashMap.make(['SAND' as BlockType, 1])
        const craftable = rs.findCraftable(available)
        const ids = Arr.map(craftable, (r) => r.id)
        expect(ids).not.toContain('sand-and-gravel-to-dirt')
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('returns empty array when inventory is empty', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const craftable = rs.findCraftable(HashMap.empty<BlockType, number>())
        expect(craftable).toHaveLength(0)
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('returns multiple craftable recipes when inventory is fully stocked', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const available = HashMap.make(
          ['WOOD' as BlockType, 64],
          ['STONE' as BlockType, 64],
          ['GRASS' as BlockType, 64],
          ['SAND' as BlockType, 64],
          ['GRAVEL' as BlockType, 64],
          ['DIRT' as BlockType, 64],
          ['COBBLESTONE' as BlockType, 64],
        )
        const craftable = rs.findCraftable(available)
        expect(craftable.length).toBeGreaterThanOrEqual(5)
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('returns a recipe only when ingredient count exactly meets requirement', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        // wood-and-stone-to-glass requires WOOD:2 and SAND:4
        const tooFewSand = HashMap.make(['WOOD' as BlockType, 2], ['SAND' as BlockType, 3])
        const exact = HashMap.make(['WOOD' as BlockType, 2], ['SAND' as BlockType, 4])

        const notCraftable = rs.findCraftable(tooFewSand)
        const craftable = rs.findCraftable(exact)

        expect(Arr.map(notCraftable, (r) => r.id)).not.toContain('wood-and-stone-to-glass')
        expect(Arr.map(craftable, (r) => r.id)).toContain('wood-and-stone-to-glass')
      }).pipe(Effect.provide(RecipeService.Default))
    )
  })

  describe('craft', () => {
    // Helper: build a minimal BlockRegistry layer that returns an empty block list
    // (InventoryService only uses getAll() at construction to populate hotbar)
    const makeBlock = (type: BlockType): Block => ({
      id: `block:${type.toLowerCase()}` as Block['id'],
      type,
      properties: { hardness: 50, transparency: false, solid: true, emissive: false, friction: 0.6 },
      faces: { top: true, bottom: true, north: true, south: true, east: true, west: true },
    })

    const emptyRegistryLayer = Layer.succeed(BlockRegistry, {
      register: (_block: Block) => Effect.void,
      get: (_blockType: BlockType) => Effect.succeed(Option.none<Block>()),
      getAll: () => Effect.succeed([] as Block[]),
      dispose: () => Effect.void,
    } as unknown as BlockRegistry)

    // Layer that starts with an empty hotbar (airOnlyBlocks → no non-AIR items)
    const emptyInventoryLayer = InventoryServiceLive.pipe(Layer.provide(emptyRegistryLayer))

    // Layer that starts with WOOD × 64 and SAND × 64 pre-stocked in the hotbar
    const woodSandRegistryLayer = Layer.succeed(BlockRegistry, {
      register: (_block: Block) => Effect.void,
      get: (_blockType: BlockType) => Effect.succeed(Option.none<Block>()),
      getAll: () => Effect.succeed([makeBlock('WOOD'), makeBlock('SAND')] as Block[]),
      dispose: () => Effect.void,
    } as unknown as BlockRegistry)
    const woodSandInventoryLayer = InventoryServiceLive.pipe(Layer.provide(woodSandRegistryLayer))

    const combinedEmpty = Layer.mergeAll(RecipeService.Default, emptyInventoryLayer)
    const combinedWoodSand = Layer.mergeAll(RecipeService.Default, woodSandInventoryLayer)

    it.effect('removes ingredients and adds result on success', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const inv = yield* InventoryService

        // Confirm we have WOOD (from hotbar init) and craft wood-to-planks (WOOD:1 → WOOD:4)
        const beforeSlots = yield* inv.getAllSlots()
        const woodBefore = Arr.reduce(beforeSlots, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'WOOD' ? item.count : 0 })
        )
        expect(woodBefore).toBeGreaterThanOrEqual(1)

        yield* rs.craft(RecipeId.make('wood-to-planks'), inv)

        const afterSlots = yield* inv.getAllSlots()
        const woodAfter = Arr.reduce(afterSlots, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'WOOD' ? item.count : 0 })
        )
        // net: -1 ingredient +4 output = woodBefore + 3
        expect(woodAfter).toBe(woodBefore + 3)
      }).pipe(Effect.provide(combinedWoodSand))
    )

    it.effect('fails with RecipeError when recipe id is unknown', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const inv = yield* InventoryService

        const result = yield* rs.craft(RecipeId.make('does-not-exist'), inv).pipe(Effect.either)
        expect(Either.isLeft(result)).toBe(true)
        const err0 = Option.getOrThrow(Either.getLeft(result))
        expect(err0._tag).toBe('RecipeError')
        expect(err0.operation).toBe('craft')
        expect(String(err0.cause)).toContain('does-not-exist')
      }).pipe(Effect.provide(combinedEmpty))
    )

    it.effect('fails with RecipeError when inventory lacks required ingredients', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const inv = yield* InventoryService

        // Empty inventory — no WOOD available
        const result = yield* rs.craft(RecipeId.make('wood-to-planks'), inv).pipe(Effect.either)
        expect(Either.isLeft(result)).toBe(true)
        const err1 = Option.getOrThrow(Either.getLeft(result))
        expect(err1._tag).toBe('RecipeError')
        expect(err1.operation).toBe('craft')
        expect(String(err1.cause)).toContain('Insufficient WOOD')
      }).pipe(Effect.provide(combinedEmpty))
    )

    it.effect('does not consume ingredients when pre-check fails (partial ingredient unavailability)', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const inv = yield* InventoryService

        // sand-and-gravel-to-dirt needs SAND:1 and GRAVEL:1.
        // woodSandInventoryLayer has WOOD and SAND but NOT GRAVEL.
        const sandBefore = Arr.reduce(yield* inv.getAllSlots(), 0,
          (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'SAND' ? item.count : 0 })
        )
        expect(sandBefore).toBeGreaterThan(0)

        const result = yield* rs.craft(RecipeId.make('sand-and-gravel-to-dirt'), inv).pipe(Effect.either)
        expect(Either.isLeft(result)).toBe(true)

        // SAND must be unchanged — pre-check must have rejected before any removal
        const sandAfter = Arr.reduce(yield* inv.getAllSlots(), 0,
          (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'SAND' ? item.count : 0 })
        )
        expect(sandAfter).toBe(sandBefore)
      }).pipe(Effect.provide(combinedWoodSand))
    )

    // wood-and-stone-to-glass requires WOOD:2 and SAND:4 (both count > 1).
    // combinedWoodSand starts inventory with WOOD × 64 and SAND × 64.
    it.effect('consumes correct count when ingredient count > 1 (wood-and-stone-to-glass)', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const inv = yield* InventoryService

        const slotsBefore = yield* inv.getAllSlots()
        const woodBefore = Arr.reduce(slotsBefore, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'WOOD' ? item.count : 0 })
        )
        const sandBefore = Arr.reduce(slotsBefore, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'SAND' ? item.count : 0 })
        )
        expect(woodBefore).toBeGreaterThanOrEqual(2)
        expect(sandBefore).toBeGreaterThanOrEqual(4)

        // recipe: WOOD:2 + SAND:4 → GLASS:4
        yield* rs.craft(RecipeId.make('wood-and-stone-to-glass'), inv)

        const slotsAfter = yield* inv.getAllSlots()
        const woodAfter = Arr.reduce(slotsAfter, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'WOOD' ? item.count : 0 })
        )
        const sandAfter = Arr.reduce(slotsAfter, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'SAND' ? item.count : 0 })
        )
        const glassAfter = Arr.reduce(slotsAfter, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'GLASS' ? item.count : 0 })
        )

        // Exactly 2 WOOD consumed, exactly 4 SAND consumed, exactly 4 GLASS produced
        expect(woodAfter).toBe(woodBefore - 2)
        expect(sandAfter).toBe(sandBefore - 4)
        expect(glassAfter).toBe(4)
      }).pipe(Effect.provide(combinedWoodSand))
    )

    // cobblestone-bulk requires COBBLESTONE:4 (count > 1 single ingredient).
    // Verify that exactly 4 are consumed and exactly 4 STONE are produced.
    it.effect('consumes count > 1 from single ingredient type (cobblestone-bulk)', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const inv = yield* InventoryService

        // Empty inventory — add COBBLESTONE:10 directly via addBlock
        yield* inv.addBlock('COBBLESTONE', 10)

        const slotsBefore = yield* inv.getAllSlots()
        const cobblestoneBefore = Arr.reduce(slotsBefore, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'COBBLESTONE' ? item.count : 0 })
        )
        expect(cobblestoneBefore).toBe(10)

        // recipe: COBBLESTONE:4 → STONE:4
        yield* rs.craft(RecipeId.make('cobblestone-bulk'), inv)

        const slotsAfter = yield* inv.getAllSlots()
        const cobblestoneAfter = Arr.reduce(slotsAfter, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'COBBLESTONE' ? item.count : 0 })
        )
        const stoneAfter = Arr.reduce(slotsAfter, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'STONE' ? item.count : 0 })
        )

        expect(cobblestoneAfter).toBe(6)
        expect(stoneAfter).toBe(4)
      }).pipe(Effect.provide(combinedEmpty))
    )
  })

  // ---------------------------------------------------------------------------
  // Task 2: craft — full inventory edge cases
  // ---------------------------------------------------------------------------

  describe('craft — full inventory edge cases', () => {
    const emptyRegistryLayer = Layer.succeed(BlockRegistry, {
      register: (_block: Block) => Effect.void,
      get: (_blockType: BlockType) => Effect.succeed(Option.none<Block>()),
      getAll: () => Effect.succeed([] as Block[]),
      dispose: () => Effect.void,
    } as unknown as BlockRegistry)
    const emptyInventoryLayer = InventoryServiceLive.pipe(Layer.provide(emptyRegistryLayer))
    const combinedEmpty = Layer.mergeAll(RecipeService.Default, emptyInventoryLayer)

    // cobblestone-bulk: COBBLESTONE:4 → STONE:4
    // Fill all 36 slots to COBBLESTONE:64, then craft.
    // After crafting: 4 COBBLESTONE consumed (one slot goes from 64→60, rest remain full).
    // addBlock('STONE', 4) finds no free slots and no existing STONE stacks → returns false.
    // craft() ignores the addBlock result → Effect.void (no error).
    it.effect('full inventory: ingredients consumed, output silently dropped — no error', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const inv = yield* InventoryService

        // Fill all 36 slots with COBBLESTONE:64 (2304 total)
        // addBlock fills partial stacks first, then empty slots
        yield* inv.addBlock('COBBLESTONE', 36 * 64)

        const slotsBefore = yield* inv.getAllSlots()
        const cobblestoneBefore = Arr.reduce(slotsBefore, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'COBBLESTONE' ? item.count : 0 })
        )
        expect(cobblestoneBefore).toBe(36 * 64)

        // Verify there are no free slots
        const freeBefore = Arr.filter(slotsBefore, Option.isNone).length
        expect(freeBefore).toBe(0)

        // Craft: COBBLESTONE:4 → STONE:4
        // This should succeed with no error even though STONE can't be added
        yield* rs.craft(RecipeId.make('cobblestone-bulk'), inv)

        const slotsAfter = yield* inv.getAllSlots()
        const cobblestoneAfter = Arr.reduce(slotsAfter, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'COBBLESTONE' ? item.count : 0 })
        )
        const stoneAfter = Arr.reduce(slotsAfter, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'STONE' ? item.count : 0 })
        )

        // 4 COBBLESTONE consumed
        expect(cobblestoneAfter).toBe(36 * 64 - 4)
        // Output STONE:4 was silently dropped (no free slot, no existing STONE stack)
        expect(stoneAfter).toBe(0)
      }).pipe(Effect.provide(combinedEmpty))
    )

    // Craft with exactly one free slot: stone-to-cobblestone (STONE:1 → COBBLESTONE:1)
    // Fill 35 slots with COBBLESTONE:64, leave slot 0 empty, add STONE:1 to slot 0.
    // We use addBlock to manage this: add COBBLESTONE:35*64 (fills slots 0..34),
    // then add STONE:1 (goes to slot 35 — the first free slot).
    // Wait, that puts STONE in slot 35 not slot 0. But slot order doesn't matter for the test.
    // After crafting STONE:1→COBBLESTONE:1: STONE consumed (its slot freed), COBBLESTONE:1 added
    // (merges into an existing COBBLESTONE stack since they aren't all at 64).
    // Actually all 35 COBBLESTONE slots ARE at 64 — no merge room. The freed STONE slot gets COBBLESTONE:1.
    it.effect('exactly one free slot after ingredient removal: output IS added successfully', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const inv = yield* InventoryService

        // Fill 35 slots with COBBLESTONE:64 (slots 0..34)
        yield* inv.addBlock('COBBLESTONE', 35 * 64)
        // Add STONE:1 — goes into slot 35 (the only free slot)
        yield* inv.addBlock('STONE', 1)

        const slotsBefore = yield* inv.getAllSlots()
        const stoneBefore = Arr.reduce(slotsBefore, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'STONE' ? item.count : 0 })
        )
        const freeBefore = Arr.filter(slotsBefore, Option.isNone).length
        expect(stoneBefore).toBe(1)
        expect(freeBefore).toBe(0)

        // Craft stone-to-cobblestone: STONE:1 → COBBLESTONE:1
        yield* rs.craft(RecipeId.make('stone-to-cobblestone'), inv)

        const slotsAfter = yield* inv.getAllSlots()
        const stoneAfter = Arr.reduce(slotsAfter, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'STONE' ? item.count : 0 })
        )
        const cobblestoneAfter = Arr.reduce(slotsAfter, 0, (sum, s) => sum + Option.match(s, { onNone: () => 0, onSome: (item) => item.blockType === 'COBBLESTONE' ? item.count : 0 })
        )

        // STONE ingredient consumed
        expect(stoneAfter).toBe(0)
        // COBBLESTONE output added: slot 35 (freed from STONE) now holds COBBLESTONE:1
        // Total COBBLESTONE = 35*64 + 1
        expect(cobblestoneAfter).toBe(35 * 64 + 1)
      }).pipe(Effect.provide(combinedEmpty))
    )
  })
})
