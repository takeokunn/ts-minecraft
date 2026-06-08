import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { INDEX_TO_BLOCK_TYPE } from '@ts-minecraft/core'
import { ITEM_TILE_MAP, TILE_MAP } from '@ts-minecraft/rendering'

const endBlockTypes = [
  'CHORUS_FLOWER',
  'CHORUS_PLANT',
  'DRAGON_EGG',
  'END_CRYSTAL',
  'END_GATEWAY',
  'END_ROD',
  'END_STONE_BRICKS',
  'ENDER_CHEST',
  'PURPUR_BLOCK',
  'PURPUR_PILLAR',
  'PURPUR_SLAB',
  'PURPUR_STAIRS',
  'SHULKER_BOX',
] as const

const endItemTypes = [
  'CHORUS_FRUIT',
  'DRAGON_BREATH',
  'DRAGON_EGG',
  'ELYTRA',
  'END_CRYSTAL',
  'ENDER_EYE',
  'POPPED_CHORUS_FRUIT',
  'SHULKER_SHELL',
] as const

describe('Phase 18 The End texture maps', () => {
  it('has a block texture entry for every block storage index', () => {
    expect(TILE_MAP).toHaveLength(INDEX_TO_BLOCK_TYPE.length)
  })

  it('has inventory icons for new End blocks and items', () => {
    Arr.forEach([...endBlockTypes, ...endItemTypes], (type) => {
      expect(ITEM_TILE_MAP[type]).toBeGreaterThanOrEqual(0)
    })
  })
})
