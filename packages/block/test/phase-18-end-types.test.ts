import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Option, Schema } from 'effect'
import {
  BlockTypeSchema,
  INDEX_TO_BLOCK_TYPE,
  ItemTypeSchema,
  blockTypeToIndex,
  indexToBlockType,
  isValidBlockType,
} from '@ts-minecraft/core'
import { endBlocks } from '@ts-minecraft/block/domain/blocks.config.end'
import { initialBlocks } from '@ts-minecraft/block/domain/blocks.config'

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

describe('Phase 18 The End type schemas', () => {
  it('accepts all new End block types', () => {
    const decode = Schema.decodeUnknownSync(BlockTypeSchema)
    Arr.forEach(endBlockTypes, (type) => expect(decode(type)).toBe(type))
  })

  it('accepts all new End item types', () => {
    const decode = Schema.decodeUnknownSync(ItemTypeSchema)
    Arr.forEach(endItemTypes, (type) => expect(decode(type)).toBe(type))
  })

})

describe('Phase 18 The End block storage and config', () => {
  it('appends new End block indices after existing storage indices', () => {
    expect(INDEX_TO_BLOCK_TYPE[58]).toBe('TNT')
    expect(INDEX_TO_BLOCK_TYPE.slice(59, 59 + endBlockTypes.length)).toEqual([...endBlockTypes])
    Arr.forEach(endBlockTypes, (type) => {
      expect(indexToBlockType(blockTypeToIndex(type))).toBe(type)
      expect(isValidBlockType(type)).toBe(true)
    })
  })

  it('registers each new End block exactly once in initialBlocks', () => {
    Arr.forEach(endBlockTypes, (type) => {
      const matches = initialBlocks.filter((block) => block.type === type)
      expect(matches).toHaveLength(1)
    })
  })

  it('keeps END_STONE in crafted config and does not duplicate it in endBlocks', () => {
    expect(endBlocks.some((block) => block.type === 'END_STONE')).toBe(false)
    expect(initialBlocks.filter((block) => block.type === 'END_STONE')).toHaveLength(1)
  })

  it('uses expected End block properties', () => {
    const block = (type: (typeof endBlockTypes)[number]) =>
      Option.getOrThrow(Arr.findFirst(endBlocks, (entry) => entry.type === type))

    expect(block('CHORUS_FLOWER').properties).toMatchObject({ hardness: 0.4, solid: false })
    expect(block('CHORUS_PLANT').properties).toMatchObject({ hardness: 0.4, solid: false })
    expect(block('DRAGON_EGG').properties).toMatchObject({ hardness: 3, solid: true, transparency: true })
    expect(block('END_CRYSTAL').properties).toMatchObject({ solid: false, transparency: true })
    expect(block('END_GATEWAY').properties).toMatchObject({ hardness: -1, solid: false, emissive: true })
    expect(block('END_ROD').properties).toMatchObject({ hardness: 0, solid: false, emissive: true })
    expect(block('END_STONE_BRICKS').properties).toMatchObject({ hardness: 45, solid: true })
    expect(block('ENDER_CHEST').properties).toMatchObject({ hardness: 22.5, solid: true, emissive: true })
    expect(block('PURPUR_BLOCK').properties).toMatchObject({ hardness: 1.5, solid: true })
    expect(block('PURPUR_PILLAR').properties).toMatchObject({ hardness: 1.5, solid: true })
    expect(block('PURPUR_SLAB').properties).toMatchObject({ hardness: 1.5, solid: true, transparency: true })
    expect(block('PURPUR_STAIRS').properties).toMatchObject({ hardness: 1.5, solid: true, transparency: true })
    expect(block('SHULKER_BOX').properties).toMatchObject({ hardness: 2, solid: true })
  })
})
