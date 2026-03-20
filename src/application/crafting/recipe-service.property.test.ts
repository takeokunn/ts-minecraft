/**
 * Gap Q — RecipeService findCraftable monotonicity property
 *
 * Invariant: if findCraftable(available) returns recipe R, then
 * findCraftable({...available, moreStuff}) must also return R.
 * Adding items never removes a craftable recipe.
 */
import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { RecipeService } from '@/application/crafting/recipe-service'

describe('recipe-service / findCraftable (property-based)', () => {
  it.effect(
    'monotonicity: adding more items never removes a previously craftable recipe',
    () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const allRecipes = rs.getAllRecipes()

        // Collect the universe of block types that appear in any ingredient
        const allBlockTypes = Array.from(
          new Set(allRecipes.flatMap((r) => r.ingredients.map((ing) => ing.blockType)))
        )

        fc.assert(
          fc.property(
            // Generate a base inventory: random count [0, 64] for each block type
            fc.record(
              Object.fromEntries(allBlockTypes.map((bt) => [bt, fc.integer({ min: 0, max: 64 })]))
            ) as fc.Arbitrary<Record<string, number>>,
            // Generate extra items to add: random count [0, 64] for each block type
            fc.record(
              Object.fromEntries(allBlockTypes.map((bt) => [bt, fc.integer({ min: 0, max: 64 })]))
            ) as fc.Arbitrary<Record<string, number>>,
            (baseRecord, extraRecord) => {
              const baseMap = new Map<string, number>(
                Object.entries(baseRecord).filter(([, v]) => v > 0)
              )

              // Augmented inventory: base + extra for each key
              const augmentedMap = new Map<string, number>(baseMap)
              for (const [bt, count] of Object.entries(extraRecord)) {
                if (count > 0) {
                  augmentedMap.set(bt, (augmentedMap.get(bt) ?? 0) + count)
                }
              }

              const baseIds = new Set(rs.findCraftable(baseMap).map((r) => r.id))
              const augmentedIds = new Set(rs.findCraftable(augmentedMap).map((r) => r.id))

              // Every recipe craftable from base must still be craftable from augmented
              for (const id of baseIds) {
                if (!augmentedIds.has(id)) {
                  return false
                }
              }
              return true
            }
          )
        )
      }).pipe(Effect.provide(RecipeService.Default))
  )

  it.effect(
    'empty inventory always yields empty findCraftable result',
    () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        fc.assert(
          fc.property(
            // Empty map (no entries): no matter what, result is empty
            fc.constant(new Map<string, number>()),
            (empty) => {
              return rs.findCraftable(empty).length === 0
            }
          )
        )
      }).pipe(Effect.provide(RecipeService.Default))
  )

  it.effect(
    'findCraftable result is a subset of getAllRecipes',
    () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const allIds = new Set(rs.getAllRecipes().map((r) => r.id))
        const allBlockTypes = Array.from(
          new Set(rs.getAllRecipes().flatMap((r) => r.ingredients.map((ing) => ing.blockType)))
        )

        fc.assert(
          fc.property(
            fc.record(
              Object.fromEntries(allBlockTypes.map((bt) => [bt, fc.integer({ min: 0, max: 64 })]))
            ) as fc.Arbitrary<Record<string, number>>,
            (inventoryRecord) => {
              const available = new Map<string, number>(
                Object.entries(inventoryRecord).filter(([, v]) => v > 0)
              )
              const craftable = rs.findCraftable(available)
              return craftable.every((r) => allIds.has(r.id))
            }
          )
        )
      }).pipe(Effect.provide(RecipeService.Default))
  )

  it.effect(
    'findCraftable with sufficient ingredients for every recipe returns all recipes',
    () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const allRecipes = rs.getAllRecipes()
        const allIds = new Set(allRecipes.map((r) => r.id))

        // Build a map with 64 of every required ingredient block type
        const fullyStocked = new Map<string, number>()
        for (const recipe of allRecipes) {
          for (const ing of recipe.ingredients) {
            fullyStocked.set(ing.blockType, 64)
          }
        }

        const craftable = rs.findCraftable(fullyStocked)
        const craftableIds = new Set(craftable.map((r) => r.id))

        // All known recipes must be craftable when all ingredients are available
        for (const id of allIds) {
          if (!craftableIds.has(id)) {
            throw new Error(`Recipe ${id} should be craftable with fully stocked inventory`)
          }
        }
      }).pipe(Effect.provide(RecipeService.Default))
  )
})
