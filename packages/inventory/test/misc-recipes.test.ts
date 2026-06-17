import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { MISC_RECIPES } from '../application/recipes/misc-recipes'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const findById = (id: string) => MISC_RECIPES.find((r) => r.id === id)

const ingredientTotal = (id: string): number => {
  const recipe = findById(id)
  if (!recipe) return 0
  return Arr.reduce(recipe.ingredients, 0, (sum, ing) => sum + ing.count)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('application/recipes/misc-recipes', () => {
  describe('structural invariants', () => {
    it('has no duplicate recipe IDs', () => {
      const ids = MISC_RECIPES.map((r) => r.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(ids.length)
    })

    it('every recipe has at least one ingredient', () => {
      for (const recipe of MISC_RECIPES) {
        expect(recipe.ingredients.length, `${recipe.id} has no ingredients`).toBeGreaterThanOrEqual(1)
      }
    })

    it('every ingredient count is between 1 and 64', () => {
      for (const recipe of MISC_RECIPES) {
        for (const ing of recipe.ingredients) {
          expect(ing.count, `${recipe.id} ingredient count out of range`).toBeGreaterThanOrEqual(1)
          expect(ing.count, `${recipe.id} ingredient count out of range`).toBeLessThanOrEqual(64)
        }
      }
    })

    it('every output count is between 1 and 64', () => {
      for (const recipe of MISC_RECIPES) {
        expect(recipe.output.count, `${recipe.id} output count out of range`).toBeGreaterThanOrEqual(1)
        expect(recipe.output.count, `${recipe.id} output count out of range`).toBeLessThanOrEqual(64)
      }
    })
  })

  describe('station coverage', () => {
    it('contains inventory recipes', () => {
      const inventoryRecipes = MISC_RECIPES.filter((r) => r.station === 'inventory')
      expect(inventoryRecipes.length).toBeGreaterThan(0)
    })

    it('contains crafting_table recipes', () => {
      const tableRecipes = MISC_RECIPES.filter((r) => r.station === 'crafting_table')
      expect(tableRecipes.length).toBeGreaterThan(0)
    })

    it('contains furnace recipes', () => {
      const furnaceRecipes = MISC_RECIPES.filter((r) => r.station === 'furnace')
      expect(furnaceRecipes.length).toBeGreaterThan(0)
    })
  })

  describe('core progression recipes', () => {
    it('wood-to-planks: 1 WOOD → 4 PLANKS at inventory station', () => {
      const recipe = findById('wood-to-planks')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('inventory')
      expect(recipe!.output.itemType).toBe('PLANKS')
      expect(recipe!.output.count).toBe(4)
      expect(ingredientTotal('wood-to-planks')).toBe(1)
    })

    it('planks-to-sticks: 2 PLANKS → 4 STICKS', () => {
      const recipe = findById('planks-to-sticks')
      expect(recipe).toBeDefined()
      expect(recipe!.output.itemType).toBe('STICKS')
      expect(recipe!.output.count).toBe(4)
      expect(ingredientTotal('planks-to-sticks')).toBe(2)
    })

    it('planks-to-crafting-table: 4 PLANKS → 1 CRAFTING_TABLE', () => {
      const recipe = findById('planks-to-crafting-table')
      expect(recipe).toBeDefined()
      expect(recipe!.output.itemType).toBe('CRAFTING_TABLE')
      expect(recipe!.output.count).toBe(1)
      expect(ingredientTotal('planks-to-crafting-table')).toBe(4)
    })

    it('cobblestone-to-furnace: 8 COBBLESTONE → 1 FURNACE at crafting_table', () => {
      const recipe = findById('cobblestone-to-furnace')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('crafting_table')
      expect(recipe!.output.itemType).toBe('FURNACE')
      expect(recipe!.output.count).toBe(1)
      expect(ingredientTotal('cobblestone-to-furnace')).toBe(8)
    })

    it('planks-to-chest: 8 PLANKS -> 1 CHEST at crafting_table', () => {
      const recipe = findById('planks-to-chest')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('crafting_table')
      expect(recipe!.output.itemType).toBe('CHEST')
      expect(recipe!.output.count).toBe(1)
      expect(ingredientTotal('planks-to-chest')).toBe(8)
    })

    it('planks-to-door: 6 PLANKS -> 3 DOOR at crafting_table', () => {
      const recipe = findById('planks-to-door')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('crafting_table')
      expect(recipe!.output.itemType).toBe('DOOR')
      expect(recipe!.output.count).toBe(3)
      expect(ingredientTotal('planks-to-door')).toBe(6)
    })

    it('sticks-to-ladder: 7 STICKS -> 3 LADDER at crafting_table', () => {
      const recipe = findById('sticks-to-ladder')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('crafting_table')
      expect(recipe!.output.itemType).toBe('LADDER')
      expect(recipe!.output.count).toBe(3)
      expect(ingredientTotal('sticks-to-ladder')).toBe(7)
    })

    it('glowstone-dust-to-glowstone: 4 GLOWSTONE_DUST -> 1 GLOWSTONE at inventory', () => {
      const recipe = findById('glowstone-dust-to-glowstone')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('inventory')
      expect(recipe!.output.itemType).toBe('GLOWSTONE')
      expect(recipe!.output.count).toBe(1)
      expect(ingredientTotal('glowstone-dust-to-glowstone')).toBe(4)
    })
  })

  describe('torch recipes (coal and charcoal)', () => {
    it('coal-and-stick-to-torches: produces 4 TORCH', () => {
      const recipe = findById('coal-and-stick-to-torches')
      expect(recipe).toBeDefined()
      expect(recipe!.output.itemType).toBe('TORCH')
      expect(recipe!.output.count).toBe(4)
    })

    it('charcoal-and-stick-to-torches: produces 4 TORCH (vanilla parity)', () => {
      const recipe = findById('charcoal-and-stick-to-torches')
      expect(recipe).toBeDefined()
      expect(recipe!.output.itemType).toBe('TORCH')
      expect(recipe!.output.count).toBe(4)
    })

    it('both torch recipes require 1 fuel + 1 STICKS', () => {
      expect(ingredientTotal('coal-and-stick-to-torches')).toBe(2)
      expect(ingredientTotal('charcoal-and-stick-to-torches')).toBe(2)
    })
  })

  describe('smelting recipes', () => {
    it('wood-to-charcoal: furnace station', () => {
      const recipe = findById('wood-to-charcoal')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('furnace')
      expect(recipe!.output.itemType).toBe('CHARCOAL')
    })

    it('raw-iron-to-iron-ingot: 1 RAW_IRON → 1 IRON_INGOT', () => {
      const recipe = findById('raw-iron-to-iron-ingot')
      expect(recipe).toBeDefined()
      expect(recipe!.output.itemType).toBe('IRON_INGOT')
      expect(recipe!.output.count).toBe(1)
    })

    it('raw-gold-to-gold-ingot: 1 RAW_GOLD → 1 GOLD_INGOT', () => {
      const recipe = findById('raw-gold-to-gold-ingot')
      expect(recipe).toBeDefined()
      expect(recipe!.output.itemType).toBe('GOLD_INGOT')
    })

    it('cobblestone-to-stone: cobblestone in furnace → stone', () => {
      const recipe = findById('cobblestone-to-stone')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('furnace')
      expect(recipe!.output.itemType).toBe('STONE')
    })

    it('sand-to-glass: 1 SAND → 1 GLASS', () => {
      const recipe = findById('sand-to-glass')
      expect(recipe).toBeDefined()
      expect(recipe!.output.itemType).toBe('GLASS')
    })

    it('raw meat and fish variants all use furnace station', () => {
      const smeltedFood = [
        'raw-beef-to-cooked-beef',
        'raw-pork-to-cooked-porkchop',
        'raw-mutton-to-cooked-mutton',
        'raw-chicken-to-cooked-chicken',
        'raw-cod-to-cooked-cod',
        'raw-salmon-to-cooked-salmon',
      ]
      for (const id of smeltedFood) {
        const recipe = findById(id)
        expect(recipe, `${id} missing`).toBeDefined()
        expect(recipe!.station, `${id} should be furnace`).toBe('furnace')
      }
    })
  })

  describe('equipment and survival items', () => {
    it('bow: 3 STRING + 3 STICKS at crafting_table', () => {
      const recipe = findById('string-and-sticks-to-bow')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('crafting_table')
      expect(recipe!.output.itemType).toBe('BOW')
      expect(ingredientTotal('string-and-sticks-to-bow')).toBe(6)
    })

    it('shield: 6 PLANKS + 1 IRON_INGOT → 1 SHIELD', () => {
      const recipe = findById('planks-and-iron-ingot-to-shield')
      expect(recipe).toBeDefined()
      expect(recipe!.output.itemType).toBe('SHIELD')
      expect(ingredientTotal('planks-and-iron-ingot-to-shield')).toBe(7)
    })

    it('golden-apple: 8 GOLD_INGOT + 1 APPLE at crafting_table', () => {
      const recipe = findById('gold-and-apple-to-golden-apple')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('crafting_table')
      expect(recipe!.output.itemType).toBe('GOLDEN_APPLE')
      expect(ingredientTotal('gold-and-apple-to-golden-apple')).toBe(9)
    })

    it('bed: 3 WOOL + 3 PLANKS at crafting_table', () => {
      const recipe = findById('wool-and-planks-to-bed')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('crafting_table')
      expect(recipe!.output.itemType).toBe('BED')
      expect(ingredientTotal('wool-and-planks-to-bed')).toBe(6)
    })

    it('fishing-rod: 3 STICKS + 2 STRING at crafting_table', () => {
      const recipe = findById('sticks-and-string-to-fishing-rod')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('crafting_table')
      expect(recipe!.output.itemType).toBe('FISHING_ROD')
      expect(ingredientTotal('sticks-and-string-to-fishing-rod')).toBe(5)
    })

    it('shears: 2 IRON_INGOT → 1 SHEARS', () => {
      const recipe = findById('iron-ingots-to-shears')
      expect(recipe).toBeDefined()
      expect(recipe!.output.itemType).toBe('SHEARS')
      expect(ingredientTotal('iron-ingots-to-shears')).toBe(2)
    })

    it('bone-meal: 1 BONE → 3 BONE_MEAL (inventory)', () => {
      const recipe = findById('bone-to-bone-meal')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('inventory')
      expect(recipe!.output.itemType).toBe('BONE_MEAL')
      expect(recipe!.output.count).toBe(3)
    })

    it('bread: 3 WHEAT → 1 BREAD (inventory)', () => {
      const recipe = findById('wheat-to-bread')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('inventory')
      expect(recipe!.output.itemType).toBe('BREAD')
    })

    it('arrows: 1 FLINT + 1 STICKS + 1 FEATHER → 4 ARROW at crafting_table', () => {
      const recipe = findById('flint-stick-feather-to-arrows')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('crafting_table')
      expect(recipe!.output.itemType).toBe('ARROW')
      expect(recipe!.output.count).toBe(4)
      expect(recipe!.ingredients.map((ing) => ing.itemType)).toEqual(['FLINT', 'STICKS', 'FEATHER'])
      expect(ingredientTotal('flint-stick-feather-to-arrows')).toBe(3)
    })

    it('bucket: 3 IRON_INGOT → 1 BUCKET at crafting_table', () => {
      const recipe = findById('iron-ingots-to-bucket')
      expect(recipe).toBeDefined()
      expect(recipe!.output.itemType).toBe('BUCKET')
      expect(ingredientTotal('iron-ingots-to-bucket')).toBe(3)
    })

    it('flint-and-steel: 1 FLINT + 1 IRON_INGOT at crafting_table', () => {
      const recipe = findById('flint-and-iron-to-flint-and-steel')
      expect(recipe).toBeDefined()
      expect(recipe!.station).toBe('crafting_table')
      expect(recipe!.output.itemType).toBe('FLINT_AND_STEEL')
      expect(ingredientTotal('flint-and-iron-to-flint-and-steel')).toBe(2)
    })
  })
})
