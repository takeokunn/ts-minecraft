import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import { RecipeIngredient, Recipe } from './crafting'

describe('RecipeIngredient', () => {
  it('creates a valid ingredient with count=1', () => {
    const ingredient = new RecipeIngredient({ blockType: 'STONE', count: 1 })
    expect(ingredient['blockType']).toBe('STONE')
    expect(ingredient['count']).toBe(1)
  })

  it('creates a valid ingredient with count=64', () => {
    const ingredient = new RecipeIngredient({ blockType: 'DIRT', count: 64 })
    expect(ingredient['blockType']).toBe('DIRT')
    expect(ingredient['count']).toBe(64)
  })

  it('creates a valid ingredient with a mid-range count', () => {
    const ingredient = new RecipeIngredient({ blockType: 'WOOD', count: 32 })
    expect(ingredient['blockType']).toBe('WOOD')
    expect(ingredient['count']).toBe(32)
  })

  it('rejects count=0 (below minimum of 1)', () => {
    expect(() => Schema.decodeUnknownSync(RecipeIngredient)({ blockType: 'STONE', count: 0 })).toThrow()
  })

  it('rejects count=65 (above maximum of 64)', () => {
    expect(() => Schema.decodeUnknownSync(RecipeIngredient)({ blockType: 'STONE', count: 65 })).toThrow()
  })

  it('rejects negative count', () => {
    expect(() => Schema.decodeUnknownSync(RecipeIngredient)({ blockType: 'STONE', count: -1 })).toThrow()
  })

  it('encode/decode roundtrip for RecipeIngredient', () => {
    const decoded = Schema.decodeUnknownSync(RecipeIngredient)({ blockType: 'GRASS', count: 16 })
    const encoded = Schema.encodeSync(RecipeIngredient)(decoded)
    const decoded2 = Schema.decodeUnknownSync(RecipeIngredient)(encoded)
    expect(decoded2['blockType']).toBe('GRASS')
    expect(decoded2['count']).toBe(16)
  })
})

describe('Recipe', () => {
  it('creates a valid Recipe with one ingredient', () => {
    const recipe = Schema.decodeUnknownSync(Recipe)({
      id: 'recipe-001',
      ingredients: [{ blockType: 'STONE', count: 4 }],
      output: { blockType: 'COBBLESTONE', count: 1 },
    })
    expect(recipe['id']).toBe('recipe-001')
    expect(recipe['ingredients']).toHaveLength(1)
    expect(recipe['output']['blockType']).toBe('COBBLESTONE')
  })

  it('creates a valid Recipe with multiple ingredients', () => {
    const recipe = Schema.decodeUnknownSync(Recipe)({
      id: 'recipe-002',
      ingredients: [
        { blockType: 'WOOD', count: 2 },
        { blockType: 'STONE', count: 3 },
      ],
      output: { blockType: 'DIRT', count: 1 },
    })
    expect(recipe['ingredients']).toHaveLength(2)
  })

  it('rejects Recipe with empty ingredients array', () => {
    expect(() =>
      Schema.decodeUnknownSync(Recipe)({
        id: 'recipe-003',
        ingredients: [],
        output: { blockType: 'STONE', count: 1 },
      })
    ).toThrow()
  })

  it('rejects Recipe with invalid output blockType', () => {
    expect(() =>
      Schema.decodeUnknownSync(Recipe)({
        id: 'recipe-004',
        ingredients: [{ blockType: 'STONE', count: 1 }],
        output: { blockType: 'INVALID_BLOCK', count: 1 },
      })
    ).toThrow()
  })

  it('rejects Recipe with output count=0', () => {
    expect(() =>
      Schema.decodeUnknownSync(Recipe)({
        id: 'recipe-005',
        ingredients: [{ blockType: 'STONE', count: 1 }],
        output: { blockType: 'STONE', count: 0 },
      })
    ).toThrow()
  })

  it('encode/decode roundtrip for Recipe', () => {
    const original = Schema.decodeUnknownSync(Recipe)({
      id: 'recipe-roundtrip',
      ingredients: [{ blockType: 'SAND', count: 8 }],
      output: { blockType: 'GLASS', count: 8 },
    })
    const encoded = Schema.encodeSync(Recipe)(original)
    const decoded = Schema.decodeUnknownSync(Recipe)(encoded)
    expect(decoded['id']).toBe('recipe-roundtrip')
    expect(decoded['ingredients'][0]?.['blockType']).toBe('SAND')
    expect(decoded['ingredients'][0]?.['count']).toBe(8)
    expect(decoded['output']['blockType']).toBe('GLASS')
    expect(decoded['output']['count']).toBe(8)
  })
})
