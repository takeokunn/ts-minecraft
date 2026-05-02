import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, HashSet } from 'effect'
import { initialBlocks, defaultBlockProperties, defaultBlockFaces } from './blocks.config'

const ALL_BLOCK_TYPES: ReadonlyArray<string> = [
  'AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'WATER', 'LEAVES', 'GLASS', 'SNOW', 'GRAVEL', 'COBBLESTONE',
  'GRANITE', 'DIORITE', 'ANDESITE', 'DEEPSLATE', 'BEDROCK', 'LAVA', 'OBSIDIAN',
  'COAL_ORE', 'IRON_ORE', 'GOLD_ORE', 'DIAMOND_ORE', 'REDSTONE_ORE', 'LAPIS_ORE', 'EMERALD_ORE',
  'DEEPSLATE_COAL_ORE', 'DEEPSLATE_IRON_ORE', 'DEEPSLATE_GOLD_ORE', 'DEEPSLATE_DIAMOND_ORE',
  'DEEPSLATE_REDSTONE_ORE', 'DEEPSLATE_LAPIS_ORE', 'DEEPSLATE_EMERALD_ORE',
  'COAL_BLOCK', 'IRON_BLOCK', 'GOLD_BLOCK', 'DIAMOND_BLOCK', 'REDSTONE_BLOCK', 'LAPIS_BLOCK', 'EMERALD_BLOCK',
  'PLANKS', 'STICKS', 'CRAFTING_TABLE', 'FURNACE', 'TORCH', 'COAL', 'WOODEN_SWORD', 'WOODEN_PICKAXE',
  'STONE_PICKAXE', 'RAW_IRON', 'IRON_INGOT', 'IRON_PICKAXE', 'RAW_GOLD', 'GOLD_INGOT', 'DIAMOND',
  'REDSTONE_DUST', 'LAPIS_LAZULI', 'EMERALD', 'DIAMOND_PICKAXE',
]

describe('blocks.config — data integrity', () => {
  it('initialBlocks covers every BlockType exactly once', () => {
    const types = Arr.map(initialBlocks, (b) => b.type)
    const unique = HashSet.fromIterable(types)
    expect(HashSet.size(unique)).toBe(ALL_BLOCK_TYPES.length)
    expect(types.length).toBe(ALL_BLOCK_TYPES.length)
  })

  it('every block id matches the pattern "block:<lowercase_type>"', () => {
    Arr.forEach(initialBlocks, (block) => {
      expect(String(block.id)).toBe(`block:${block.type.toLowerCase()}`)
    })
  })

  it('AIR has hardness 0, transparency true, solid false', () => {
    const air = Arr.findFirst(initialBlocks, (b) => b.type === 'AIR')
    expect(air._tag).toBe('Some')
    if (air._tag === 'Some') {
      expect(air.value.properties.hardness).toBe(0)
      expect(air.value.properties.transparency).toBe(true)
      expect(air.value.properties.solid).toBe(false)
    }
  })

  it('WATER is not solid and is transparent', () => {
    const water = Arr.findFirst(initialBlocks, (b) => b.type === 'WATER')
    expect(water._tag).toBe('Some')
    if (water._tag === 'Some') {
      expect(water.value.properties.solid).toBe(false)
      expect(water.value.properties.transparency).toBe(true)
    }
  })

  it('BEDROCK has hardness 100', () => {
    const bedrock = Arr.findFirst(initialBlocks, (b) => b.type === 'BEDROCK')
    expect(bedrock._tag).toBe('Some')
    if (bedrock._tag === 'Some') {
      expect(bedrock.value.properties.hardness).toBe(100)
    }
  })

  it('all blocks have valid hardness (0-100)', () => {
    Arr.forEach(initialBlocks, (block) => {
      expect(block.properties.hardness).toBeGreaterThanOrEqual(0)
      expect(block.properties.hardness).toBeLessThanOrEqual(100)
    })
  })

  it('all blocks have valid friction (0-1)', () => {
    Arr.forEach(initialBlocks, (block) => {
      expect(block.properties.friction).toBeGreaterThanOrEqual(0)
      expect(block.properties.friction).toBeLessThanOrEqual(1)
    })
  })

  it('defaultBlockProperties has expected values', () => {
    expect(defaultBlockProperties.hardness).toBe(50)
    expect(defaultBlockProperties.solid).toBe(true)
    expect(defaultBlockProperties.transparency).toBe(false)
    expect(defaultBlockProperties.emissive).toBe(false)
    expect(defaultBlockProperties.friction).toBe(0.6)
  })

  it('defaultBlockFaces has all faces true', () => {
    expect(defaultBlockFaces.top).toBe(true)
    expect(defaultBlockFaces.bottom).toBe(true)
    expect(defaultBlockFaces.north).toBe(true)
    expect(defaultBlockFaces.south).toBe(true)
    expect(defaultBlockFaces.east).toBe(true)
    expect(defaultBlockFaces.west).toBe(true)
  })
})
