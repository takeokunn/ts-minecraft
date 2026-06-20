import { describe, it, expect } from 'vitest'
import { HashSet } from 'effect'
import {
  WOODEN_PICKAXE_HARVESTABLE_BLOCKS,
  STONE_PICKAXE_HARVESTABLE_BLOCKS,
  IRON_PICKAXE_HARVESTABLE_BLOCKS,
  DIAMOND_PICKAXE_HARVESTABLE_BLOCKS,
  PICKAXE_HARVEST_SETS,
  PICKAXE_REQUIRED_BLOCKS,
  PICKAXE_TOOLS,
  getPickaxeHarvestableBlocks,
  isPickaxeTool,
} from '../domain/harvestable-blocks'

describe('pickaxe tier harvestable blocks', () => {
  it('wooden tier includes basic stone and coal ore', () => {
    expect(HashSet.has(WOODEN_PICKAXE_HARVESTABLE_BLOCKS, 'STONE')).toBe(true)
    expect(HashSet.has(WOODEN_PICKAXE_HARVESTABLE_BLOCKS, 'PRESSURE_PLATE')).toBe(true)
    expect(HashSet.has(WOODEN_PICKAXE_HARVESTABLE_BLOCKS, 'STONE_SLAB')).toBe(true)
    expect(HashSet.has(WOODEN_PICKAXE_HARVESTABLE_BLOCKS, 'ANVIL')).toBe(true)
    expect(HashSet.has(WOODEN_PICKAXE_HARVESTABLE_BLOCKS, 'CAULDRON')).toBe(true)
    expect(HashSet.has(WOODEN_PICKAXE_HARVESTABLE_BLOCKS, 'WATER_CAULDRON')).toBe(true)
    expect(HashSet.has(WOODEN_PICKAXE_HARVESTABLE_BLOCKS, 'COAL_ORE')).toBe(true)
    expect(HashSet.has(WOODEN_PICKAXE_HARVESTABLE_BLOCKS, 'DEEPSLATE_COAL_ORE')).toBe(true)
  })

  it('wooden tier does NOT include iron ore', () => {
    expect(HashSet.has(WOODEN_PICKAXE_HARVESTABLE_BLOCKS, 'IRON_ORE')).toBe(false)
    expect(HashSet.has(WOODEN_PICKAXE_HARVESTABLE_BLOCKS, 'DIAMOND_ORE')).toBe(false)
    expect(HashSet.has(WOODEN_PICKAXE_HARVESTABLE_BLOCKS, 'OBSIDIAN')).toBe(false)
  })

  it('stone tier is a superset of wooden tier', () => {
    for (const block of WOODEN_PICKAXE_HARVESTABLE_BLOCKS) {
      expect(HashSet.has(STONE_PICKAXE_HARVESTABLE_BLOCKS, block)).toBe(true)
    }
  })

  it('stone tier adds iron ore and lapis ore', () => {
    expect(HashSet.has(STONE_PICKAXE_HARVESTABLE_BLOCKS, 'IRON_ORE')).toBe(true)
    expect(HashSet.has(STONE_PICKAXE_HARVESTABLE_BLOCKS, 'LAPIS_ORE')).toBe(true)
    expect(HashSet.has(STONE_PICKAXE_HARVESTABLE_BLOCKS, 'DEEPSLATE_IRON_ORE')).toBe(true)
  })

  it('stone tier does NOT include diamond or obsidian', () => {
    expect(HashSet.has(STONE_PICKAXE_HARVESTABLE_BLOCKS, 'DIAMOND_ORE')).toBe(false)
    expect(HashSet.has(STONE_PICKAXE_HARVESTABLE_BLOCKS, 'OBSIDIAN')).toBe(false)
  })

  it('iron tier is a superset of stone tier', () => {
    for (const block of STONE_PICKAXE_HARVESTABLE_BLOCKS) {
      expect(HashSet.has(IRON_PICKAXE_HARVESTABLE_BLOCKS, block)).toBe(true)
    }
  })

  it('iron tier adds diamond, emerald, redstone, and gold ore', () => {
    expect(HashSet.has(IRON_PICKAXE_HARVESTABLE_BLOCKS, 'DIAMOND_ORE')).toBe(true)
    expect(HashSet.has(IRON_PICKAXE_HARVESTABLE_BLOCKS, 'REDSTONE_ORE')).toBe(true)
    expect(HashSet.has(IRON_PICKAXE_HARVESTABLE_BLOCKS, 'GOLD_ORE')).toBe(true)
    expect(HashSet.has(IRON_PICKAXE_HARVESTABLE_BLOCKS, 'EMERALD_ORE')).toBe(true)
  })

  it('iron tier does NOT include obsidian', () => {
    expect(HashSet.has(IRON_PICKAXE_HARVESTABLE_BLOCKS, 'OBSIDIAN')).toBe(false)
  })

  it('diamond tier is a superset of iron tier', () => {
    for (const block of IRON_PICKAXE_HARVESTABLE_BLOCKS) {
      expect(HashSet.has(DIAMOND_PICKAXE_HARVESTABLE_BLOCKS, block)).toBe(true)
    }
  })

  it('diamond tier is the only tier that includes obsidian', () => {
    expect(HashSet.has(DIAMOND_PICKAXE_HARVESTABLE_BLOCKS, 'OBSIDIAN')).toBe(true)
    expect(HashSet.has(IRON_PICKAXE_HARVESTABLE_BLOCKS, 'OBSIDIAN')).toBe(false)
  })

  it('tier sizes are strictly increasing', () => {
    expect(HashSet.size(WOODEN_PICKAXE_HARVESTABLE_BLOCKS)).toBeLessThan(
      HashSet.size(STONE_PICKAXE_HARVESTABLE_BLOCKS),
    )
    expect(HashSet.size(STONE_PICKAXE_HARVESTABLE_BLOCKS)).toBeLessThan(
      HashSet.size(IRON_PICKAXE_HARVESTABLE_BLOCKS),
    )
    expect(HashSet.size(IRON_PICKAXE_HARVESTABLE_BLOCKS)).toBeLessThan(
      HashSet.size(DIAMOND_PICKAXE_HARVESTABLE_BLOCKS),
    )
  })

  it('exposes one strict harvest set for every pickaxe tool', () => {
    expect(PICKAXE_TOOLS).toHaveLength(5)

    for (const tool of PICKAXE_TOOLS) {
      expect(getPickaxeHarvestableBlocks(tool)).toBe(PICKAXE_HARVEST_SETS[tool])
      expect(HashSet.size(getPickaxeHarvestableBlocks(tool))).toBeGreaterThan(0)
      expect(isPickaxeTool(tool)).toBe(true)
    }
  })

  it('keeps gold pickaxes on wooden-tier harvest rules', () => {
    expect(getPickaxeHarvestableBlocks('GOLD_PICKAXE')).toBe(WOODEN_PICKAXE_HARVESTABLE_BLOCKS)
  })

  it('uses the diamond tier as the pickaxe-required block catalogue', () => {
    expect(PICKAXE_REQUIRED_BLOCKS).toBe(DIAMOND_PICKAXE_HARVESTABLE_BLOCKS)
    expect(HashSet.has(PICKAXE_REQUIRED_BLOCKS, 'OBSIDIAN')).toBe(true)
  })

  it('rejects non-pickaxe inventory items', () => {
    expect(isPickaxeTool('WOODEN_SWORD')).toBe(false)
    expect(isPickaxeTool('IRON_SHOVEL')).toBe(false)
  })
})
