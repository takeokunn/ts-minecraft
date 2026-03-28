/**
 * Gap Q — RecipeService findCraftable monotonicity property
 *
 * Invariant: if findCraftable(available) returns recipe R, then
 * findCraftable({...available, moreStuff}) must also return R.
 * Adding items never removes a craftable recipe.
 */
import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect, HashMap, HashSet, Option } from 'effect'
import * as fc from 'effect/FastCheck'
import type { BlockType } from '@/domain/block'
import { RecipeService } from '@/application/crafting/recipe-service'

describe('recipe-service / findCraftable (property-based)', () => {
  it.effect(
    'monotonicity: adding more items never removes a previously craftable recipe',
    () =>
      Effect.gen(function* () {
        const rs = yield* RecipeService
        const allRecipes = rs.getAllRecipes()

        // Collect the universe of block types that appear in any ingredient
        const allBlockTypes = Arr.fromIterable(HashSet.fromIterable(
          Arr.flatMap(allRecipes, (r) => Arr.map(r.ingredients, (ing) => ing.blockType))
        ))

        fc.assert(
          fc.property(
            // Generate a base inventory: random count [0, 64] for each block type
            fc.record(
              Object.fromEntries(Arr.map(allBlockTypes, (bt) => [bt, fc.integer({ min: 0, max: 64 })]))
            ) as fc.Arbitrary<Record<string, number>>,
            // Generate extra items to add: random count [0, 64] for each block type
            fc.record(
              Object.fromEntries(Arr.map(allBlockTypes, (bt) => [bt, fc.integer({ min: 0, max: 64 })]))
            ) as fc.Arbitrary<Record<string, number>>,
            (baseRecord, extraRecord) => {
              const baseMap = HashMap.fromIterable(
                Arr.filter(Object.entries(baseRecord) as [BlockType, number][], ([, v]) => v > 0)
              )

              // Augmented inventory: base + extra for each key (immutable fold over entries)
              const augmentedMap = Arr.reduce(
                Object.entries(extraRecord) as [string, number][],
                baseMap,
                (map, [bt, count]) => {
                  if (count <= 0) return map
                  const current = Option.getOrElse(HashMap.get(map, bt as BlockType), () => 0)
                  return HashMap.set(map, bt as BlockType, current + count)
                }
              )

              const baseIds = HashSet.fromIterable(Arr.map(rs.findCraftable(baseMap), (r) => r.id))
              const augmentedIds = HashSet.fromIterable(Arr.map(rs.findCraftable(augmentedMap), (r) => r.id))

              // Every recipe craftable from base must still be craftable from augmented
              for (const id of baseIds) {
                if (!HashSet.has(augmentedIds, id)) {
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
            // Empty HashMap (no entries): no matter what, result is empty
            fc.constant(HashMap.empty<BlockType, number>()),
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
        const allIds = HashSet.fromIterable(Arr.map(rs.getAllRecipes(), (r) => r.id))
        const allBlockTypes = Arr.fromIterable(HashSet.fromIterable(
          Arr.flatMap(rs.getAllRecipes(), (r) => Arr.map(r.ingredients, (ing) => ing.blockType))
        ))

        fc.assert(
          fc.property(
            fc.record(
              Object.fromEntries(Arr.map(allBlockTypes, (bt) => [bt, fc.integer({ min: 0, max: 64 })]))
            ) as fc.Arbitrary<Record<string, number>>,
            (inventoryRecord) => {
              const available = HashMap.fromIterable(
                Arr.filter(Object.entries(inventoryRecord) as [BlockType, number][], ([, v]) => v > 0)
              )
              const craftable = rs.findCraftable(available)
              return Arr.every(craftable, (r) => HashSet.has(allIds, r.id))
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
        const allIds = HashSet.fromIterable(Arr.map(allRecipes, (r) => r.id))

        // Build a HashMap with 64 of every required ingredient block type
        const fullyStocked = Arr.reduce(allRecipes, HashMap.empty<BlockType, number>(), (map, recipe) =>
          Arr.reduce(recipe.ingredients, map, (m, ing) => HashMap.set(m, ing.blockType, 64))
        )

        const craftable = rs.findCraftable(fullyStocked)
        const craftableIds = HashSet.fromIterable(Arr.map(craftable, (r) => r.id))

        // All known recipes must be craftable when all ingredients are available
        for (const id of allIds) {
          if (!HashSet.has(craftableIds, id)) {
            throw new Error(`Recipe ${id} should be craftable with fully stocked inventory`)
          }
        }
      }).pipe(Effect.provide(RecipeService.Default))
  )
})
