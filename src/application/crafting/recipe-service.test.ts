import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { RecipeService } from '@/application/crafting/recipe-service'

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
        for (const recipe of recipes) {
          expect(recipe.id.length).toBeGreaterThan(0)
        }
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('every recipe has at least one ingredient', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const recipes = rs.getAllRecipes()
        for (const recipe of recipes) {
          expect(recipe.ingredients.length).toBeGreaterThanOrEqual(1)
        }
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('every ingredient has count between 1 and 64', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const recipes = rs.getAllRecipes()
        for (const recipe of recipes) {
          for (const ing of recipe.ingredients) {
            expect(ing.count).toBeGreaterThanOrEqual(1)
            expect(ing.count).toBeLessThanOrEqual(64)
          }
        }
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('every output has count between 1 and 64', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const recipes = rs.getAllRecipes()
        for (const recipe of recipes) {
          expect(recipe.output.count).toBeGreaterThanOrEqual(1)
          expect(recipe.output.count).toBeLessThanOrEqual(64)
        }
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('all recipe ids are unique', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const recipes = rs.getAllRecipes()
        const ids = recipes.map((r) => r.id)
        const uniqueIds = new Set(ids)
        expect(uniqueIds.size).toBe(ids.length)
      }).pipe(Effect.provide(RecipeService.Default))
    )
  })

  describe('findById', () => {
    it.effect('returns the recipe for a known id', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const recipe = rs.findById('wood-to-planks')
        expect(recipe).toBeDefined()
        expect(recipe?.id).toBe('wood-to-planks')
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('returns undefined for an unknown id', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const recipe = rs.findById('does-not-exist')
        expect(recipe).toBeUndefined()
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('returns the grass-to-dirt recipe with correct output', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const recipe = rs.findById('grass-to-dirt')
        expect(recipe).toBeDefined()
        expect(recipe?.output.blockType).toBe('DIRT')
        expect(recipe?.output.count).toBe(1)
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('returns the stone-to-cobblestone recipe with correct ingredient', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const recipe = rs.findById('stone-to-cobblestone')
        expect(recipe).toBeDefined()
        expect(recipe?.ingredients[0]?.blockType).toBe('STONE')
        expect(recipe?.output.blockType).toBe('COBBLESTONE')
      }).pipe(Effect.provide(RecipeService.Default))
    )
  })

  describe('findCraftable', () => {
    it.effect('returns matching recipes when inventory has sufficient ingredients', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const available = new Map([['WOOD', 5]])
        const craftable = rs.findCraftable(available)
        const ids = craftable.map((r) => r.id)
        expect(ids).toContain('wood-to-planks')
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('excludes recipes when ingredients are insufficient', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        // sand-and-gravel-to-dirt needs SAND:1 and GRAVEL:1 — provide only SAND
        const available = new Map([['SAND', 1]])
        const craftable = rs.findCraftable(available)
        const ids = craftable.map((r) => r.id)
        expect(ids).not.toContain('sand-and-gravel-to-dirt')
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('returns empty array when inventory is empty', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const craftable = rs.findCraftable(new Map())
        expect(craftable).toHaveLength(0)
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('returns multiple craftable recipes when inventory is fully stocked', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const available = new Map([
          ['WOOD', 64],
          ['STONE', 64],
          ['GRASS', 64],
          ['SAND', 64],
          ['GRAVEL', 64],
          ['DIRT', 64],
          ['COBBLESTONE', 64],
        ])
        const craftable = rs.findCraftable(available)
        expect(craftable.length).toBeGreaterThanOrEqual(5)
      }).pipe(Effect.provide(RecipeService.Default))
    )

    it.effect('returns a recipe only when ingredient count exactly meets requirement', () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        // wood-and-stone-to-glass requires WOOD:2 and SAND:4
        const tooFewSand = new Map([
          ['WOOD', 2],
          ['SAND', 3],
        ])
        const exact = new Map([
          ['WOOD', 2],
          ['SAND', 4],
        ])

        const notCraftable = rs.findCraftable(tooFewSand)
        const craftable = rs.findCraftable(exact)

        expect(notCraftable.map((r) => r.id)).not.toContain('wood-and-stone-to-glass')
        expect(craftable.map((r) => r.id)).toContain('wood-and-stone-to-glass')
      }).pipe(Effect.provide(RecipeService.Default))
    )
  })
})
