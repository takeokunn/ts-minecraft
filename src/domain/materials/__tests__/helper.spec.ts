import { expect, it } from '@effect/vitest'
import { materialCatalog } from '../catalog'
import { blockIdToItemId, ensureFortuneLevel, ensureMaterial, getToolHarvestLevel } from '../helper'

it('getToolHarvestLevel yields ascending progression', () => {
  const wood = Number(getToolHarvestLevel('wood'))
  const stone = Number(getToolHarvestLevel('stone'))
  const diamond = Number(getToolHarvestLevel('diamond'))
  expect(wood).toBeLessThanOrEqual(stone)
  expect(stone).toBeLessThanOrEqual(diamond)
})

it('ensureMaterial finds known material', () => {
  const sample = materialCatalog[0]
  const result = ensureMaterial(sample.blockId)
  expect(result._tag).toBe('Right')
  if (result._tag === 'Right') {
    expect(result.right.id).toBe(sample.id)
  }
})

it('blockIdToItemId returns default item id', () => {
  const sample = materialCatalog[0]
  const result = blockIdToItemId(sample.blockId)
  expect(result._tag).toBe('Right')
  if (result._tag === 'Right') {
    expect(result.right).toBe(sample.defaultItemId)
  }
})

it('ensureFortuneLevel validates range', () => {
  const valid = ensureFortuneLevel(2)
  expect(valid._tag).toBe('Right')
  const invalid = ensureFortuneLevel(10)
  expect(invalid._tag).toBe('Left')
})
