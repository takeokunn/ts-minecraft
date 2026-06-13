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

  // Cross-validate the two maps: a block's inventory icon (ITEM_TILE_MAP) is, by design, its
  // SIDE face tile from TILE_MAP. This catches a TILE_MAP that drifts out of BlockTypeSchema's
  // storage order (which would render blocks with the WRONG texture) — the count-only check
  // above can't see a same-length re-ordering.
  it('TILE_MAP[storageIndex].side equals the block inventory icon for every block', () => {
    const mismatches: string[] = []
    INDEX_TO_BLOCK_TYPE.forEach((blockType, idx) => {
      if (blockType === 'AIR') return
      const side = TILE_MAP[idx]?.side
      const icon = (ITEM_TILE_MAP as Record<string, number>)[blockType]
      if (side !== icon) mismatches.push(`${idx} ${blockType}: TILE_MAP.side=${side} ITEM_TILE_MAP=${icon}`)
    })
    expect(mismatches).toEqual([])
  })
})
