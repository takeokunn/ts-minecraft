import { describe, expect, it } from 'vitest'
import { HashMap, Option } from 'effect'
import { RecipeId } from '@ts-minecraft/core'
import {
  buildRecipeMap,
  canUseRecipe,
  countAvailableItems,
  findInsufficientIngredient,
} from '../application/recipe-service-state'
import { Recipe, RecipeIngredient } from '../domain/crafting'
import { createStack } from '../domain/item-stack'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const makeRecipe = (id: string, station: 'inventory' | 'crafting_table' | 'furnace') =>
  new Recipe({
    id: RecipeId.make(id),
    station,
    ingredients: [new RecipeIngredient({ itemType: 'PLANKS', count: 2 })],
    output: { itemType: 'STICKS', count: 4 },
  })

// ─── buildRecipeMap ───────────────────────────────────────────────────────────

describe('buildRecipeMap', () => {
  it('builds a map keyed by recipe id', () => {
    const r1 = makeRecipe('r1', 'inventory')
    const r2 = makeRecipe('r2', 'crafting_table')
    const map = buildRecipeMap([r1, r2])
    expect(HashMap.size(map)).toBe(2)
    expect(Option.isSome(HashMap.get(map, RecipeId.make('r1')))).toBe(true)
  })

  it('returns an empty map for no recipes', () => {
    expect(HashMap.size(buildRecipeMap([]))).toBe(0)
  })
})

// ─── canUseRecipe ─────────────────────────────────────────────────────────────

describe('canUseRecipe', () => {
  it('inventory station is always usable', () => {
    expect(canUseRecipe(makeRecipe('r', 'inventory'), false, false)).toBe(true)
  })

  it('crafting_table requires hasCraftingTableAccess=true', () => {
    expect(canUseRecipe(makeRecipe('r', 'crafting_table'), false, false)).toBe(false)
    expect(canUseRecipe(makeRecipe('r', 'crafting_table'), true, false)).toBe(true)
  })

  it('furnace requires hasFurnaceAccess=true', () => {
    expect(canUseRecipe(makeRecipe('r', 'furnace'), false, false)).toBe(false)
    expect(canUseRecipe(makeRecipe('r', 'furnace'), false, true)).toBe(true)
  })

  it('crafting_table access does not unlock furnace recipes', () => {
    expect(canUseRecipe(makeRecipe('r', 'furnace'), true, false)).toBe(false)
  })
})

// ─── countAvailableItems ──────────────────────────────────────────────────────

describe('countAvailableItems', () => {
  it('returns empty map for all-None slots', () => {
    const map = countAvailableItems([Option.none(), Option.none()])
    expect(HashMap.size(map)).toBe(0)
  })

  it('counts items per type', () => {
    const slots = [
      Option.some(createStack('PLANKS', 3)),
      Option.some(createStack('PLANKS', 2)),
      Option.some(createStack('STICKS', 5)),
    ]
    const map = countAvailableItems(slots)
    expect(Option.getOrNull(HashMap.get(map, 'PLANKS'))).toBe(5)
    expect(Option.getOrNull(HashMap.get(map, 'STICKS'))).toBe(5)
  })
})

// ─── findInsufficientIngredient ───────────────────────────────────────────────

describe('findInsufficientIngredient', () => {
  it('returns None when all ingredients are available', () => {
    const available = HashMap.set(HashMap.empty(), 'PLANKS' as any, 4)
    const ing = [new RecipeIngredient({ itemType: 'PLANKS', count: 4 })]
    expect(Option.isNone(findInsufficientIngredient(available, ing))).toBe(true)
  })

  it('returns Some ingredient when count is insufficient', () => {
    const available = HashMap.set(HashMap.empty(), 'PLANKS' as any, 1)
    const ing = [new RecipeIngredient({ itemType: 'PLANKS', count: 4 })]
    const found = findInsufficientIngredient(available, ing)
    expect(Option.isSome(found)).toBe(true)
    expect(Option.getOrNull(found)?.itemType).toBe('PLANKS')
  })

  it('returns Some when ingredient is entirely absent', () => {
    const available = HashMap.empty()
    const ing = [new RecipeIngredient({ itemType: 'COBBLESTONE', count: 1 })]
    expect(Option.isSome(findInsufficientIngredient(available, ing))).toBe(true)
  })
})
