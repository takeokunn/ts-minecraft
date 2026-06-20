import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Option } from 'effect'
import { Schema } from 'effect'
import { BlockTypeSchema } from '@ts-minecraft/core'
import { initialBlocks } from '@ts-minecraft/block/domain/blocks.config'
import { terrainBlocks } from '../domain/blocks.config.terrain'
import { oreAndMineralBlocks, getOreXpDrop, getOreXpDropOption, isOreXpBlock } from '../domain/blocks.config.ores'
import { craftedAndItemBlocks } from '../domain/blocks.config.crafted'
import { endBlocks } from '../domain/blocks.config.end'

// ---------------------------------------------------------------------------
// Structural invariants
// ---------------------------------------------------------------------------

describe('initialBlocks structural invariants', () => {
  it('is non-empty (at least 40 blocks)', () => {
    expect(initialBlocks.length).toBeGreaterThanOrEqual(40)
  })

  it('contains no duplicate type values', () => {
    const types = Arr.map(initialBlocks, (b) => b.type)
    const unique = new Set(types)
    expect(unique.size).toBe(types.length)
  })

  it('all block types are valid BlockType strings', () => {
    const decode = Schema.decodeUnknownSync(BlockTypeSchema)
    Arr.forEach(initialBlocks, (block) => {
      expect(() => decode(block.type)).not.toThrow()
    })
  })
})

// ---------------------------------------------------------------------------
// Known data correctness
// ---------------------------------------------------------------------------

describe('initialBlocks known data correctness', () => {
  it('AIR block exists with transparency: true and solid: false', () => {
    const air = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'AIR'))
    expect(air.properties.transparency).toBe(true)
    expect(air.properties.solid).toBe(false)
  })

  it('WATER block exists with transparency: true', () => {
    const water = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'WATER'))
    expect(water.properties.transparency).toBe(true)
  })

  it('LAVA block exists with emissive: true', () => {
    const lava = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'LAVA'))
    expect(lava.properties.emissive).toBe(true)
  })

  it('GLOWSTONE block exists as a solid maximum-light source', () => {
    const glowstone = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'GLOWSTONE'))
    expect(glowstone.properties.solid).toBe(true)
    expect(glowstone.properties.transparency).toBe(false)
    expect(glowstone.properties.emissive).toBe(true)
  })

  it('COBWEB block exists as a transparent non-solid slowing utility block', () => {
    const cobweb = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'COBWEB'))
    expect(cobweb.properties.solid).toBe(false)
    expect(cobweb.properties.transparency).toBe(true)
    expect(cobweb.properties.emissive).toBe(false)
    expect(cobweb.properties.friction).toBeLessThan(0.6)
  })

  it['each'](['SAPLING', 'DANDELION', 'POPPY', 'BROWN_MUSHROOM', 'RED_MUSHROOM', 'TALL_GRASS', 'FERN', 'SUGAR_CANE', 'LILY_PAD'] as const)(
    '%s block exists as a transparent non-solid plant block',
    (blockType) => {
      const plant = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === blockType))
      expect(plant.properties.solid).toBe(false)
      expect(plant.properties.transparency).toBe(true)
      expect(plant.properties.emissive).toBe(false)
      expect(plant.properties.hardness).toBe(0)
      expect(plant.properties.friction).toBe(0)
    },
  )

  it('CACTUS block exists as a transparent solid desert plant block', () => {
    const cactus = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'CACTUS'))
    expect(cactus.properties.solid).toBe(true)
    expect(cactus.properties.transparency).toBe(true)
    expect(cactus.properties.emissive).toBe(false)
    expect(cactus.properties.hardness).toBe(8)
    expect(cactus.properties.friction).toBe(0.6)
  })

  it('ICE block exists as a transparent solid slippery block', () => {
    const ice = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'ICE'))
    expect(ice.properties.solid).toBe(true)
    expect(ice.properties.transparency).toBe(true)
    expect(ice.properties.emissive).toBe(false)
    expect(ice.properties.hardness).toBe(3)
    expect(ice.properties.friction).toBeGreaterThan(0.8)
  })

  it('PRESSURE_PLATE block exists as a transparent non-solid stone utility block', () => {
    const pressurePlate = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'PRESSURE_PLATE'))
    expect(pressurePlate.properties.solid).toBe(false)
    expect(pressurePlate.properties.transparency).toBe(true)
    expect(pressurePlate.properties.emissive).toBe(false)
    expect(pressurePlate.properties.hardness).toBe(5)
  })

  it('STONE_SLAB block exists as a transparent solid stone-family block', () => {
    const slab = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'STONE_SLAB'))
    const stone = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'STONE'))
    expect(slab.properties.solid).toBe(true)
    expect(slab.properties.transparency).toBe(true)
    expect(slab.properties.emissive).toBe(false)
    expect(slab.properties.hardness).toBe(stone.properties.hardness)
  })

  it('OAK_STAIRS block exists as a transparent solid wood-family block', () => {
    const stairs = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'OAK_STAIRS'))
    const planks = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'PLANKS'))
    expect(stairs.properties.solid).toBe(true)
    expect(stairs.properties.transparency).toBe(true)
    expect(stairs.properties.emissive).toBe(false)
    expect(stairs.properties.hardness).toBe(planks.properties.hardness)
  })

  it('ANVIL block exists as a solid non-transparent utility block', () => {
    const anvil = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'ANVIL'))
    expect(anvil.properties.solid).toBe(true)
    expect(anvil.properties.transparency).toBe(false)
    expect(anvil.properties.emissive).toBe(false)
    expect(anvil.properties.hardness).toBe(75)
  })

  it('CAULDRON block exists as a solid non-transparent utility block', () => {
    const cauldron = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'CAULDRON'))
    expect(cauldron.properties.solid).toBe(true)
    expect(cauldron.properties.transparency).toBe(false)
    expect(cauldron.properties.emissive).toBe(false)
    expect(cauldron.properties.hardness).toBe(35)
  })

  it('WATER_CAULDRON block exists as a solid non-transparent cauldron state block', () => {
    const waterCauldron = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'WATER_CAULDRON'))
    expect(waterCauldron.properties.solid).toBe(true)
    expect(waterCauldron.properties.transparency).toBe(false)
    expect(waterCauldron.properties.emissive).toBe(false)
    expect(waterCauldron.properties.hardness).toBe(35)
  })

  it('FIRE block exists as a transparent non-solid maximum-light block', () => {
    const fire = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'FIRE'))
    expect(fire.properties.solid).toBe(false)
    expect(fire.properties.transparency).toBe(true)
    expect(fire.properties.emissive).toBe(true)
    expect(fire.properties.hardness).toBe(0)
    expect(fire.properties.friction).toBe(0)
  })

  it('STONE block exists with solid: true and transparency: false', () => {
    const stone = Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === 'STONE'))
    expect(stone.properties.solid).toBe(true)
    expect(stone.properties.transparency).toBe(false)
  })

  it('block hardness follows vanilla relative ordering', () => {
    const hardnessOf = (type: string): number =>
      Option.getOrThrow(Arr.findFirst(initialBlocks, (b) => b.type === type)).properties.hardness

    // Soft cover blocks are softer than stone (vanilla: dirt/sand/grass ~0.5-0.6 < stone 1.5).
    expect(hardnessOf('SNOW')).toBeLessThan(hardnessOf('DIRT'))
    expect(hardnessOf('SNOW')).toBeLessThan(hardnessOf('ICE'))
    expect(hardnessOf('ICE')).toBeLessThan(hardnessOf('DIRT'))
    expect(hardnessOf('PRESSURE_PLATE')).toBeLessThan(hardnessOf('STONE'))
    expect(hardnessOf('DIRT')).toBeLessThan(hardnessOf('STONE'))
    expect(hardnessOf('SAND')).toBeLessThan(hardnessOf('STONE'))
    expect(hardnessOf('GRASS')).toBeLessThan(hardnessOf('STONE'))
    expect(hardnessOf('FIRE')).toBe(0)
    // Stone-family share stone's hardness; wood (2.0) and deepslate (3.0) are harder than stone (1.5).
    expect(hardnessOf('GRANITE')).toBe(hardnessOf('STONE'))
    expect(hardnessOf('STONE_SLAB')).toBe(hardnessOf('STONE'))
    expect(hardnessOf('STONE')).toBeLessThan(hardnessOf('WOOD'))
    expect(hardnessOf('STONE')).toBeLessThan(hardnessOf('DEEPSLATE'))
    // Obsidian is very hard but breakable, below unbreakable bedrock.
    expect(hardnessOf('DEEPSLATE')).toBeLessThan(hardnessOf('OBSIDIAN'))
    expect(hardnessOf('OBSIDIAN')).toBeLessThan(hardnessOf('BEDROCK'))
    // Regression guard for the old bug: dirt must NOT be harder than wood.
    expect(hardnessOf('DIRT')).toBeLessThan(hardnessOf('WOOD'))

    // Ores: vanilla stone-tier ore (3.0) = deepslate (3.0); deepslate ore (4.5) is
    // harder; all are FAR below obsidian (50) — regression guard for the old bug
    // where ores sat at obsidian-level hardness.
    expect(hardnessOf('COAL_ORE')).toBe(hardnessOf('DEEPSLATE'))
    expect(hardnessOf('DEEPSLATE_COAL_ORE')).toBeGreaterThan(hardnessOf('COAL_ORE'))
    expect(hardnessOf('IRON_ORE')).toBeLessThan(hardnessOf('OBSIDIAN'))

    // Crafted: planks share wood's hardness (both vanilla 2.0); furnace (3.5) sits
    // between deepslate (3.0) and obsidian (50).
    expect(hardnessOf('PLANKS')).toBe(hardnessOf('WOOD'))
    expect(hardnessOf('OAK_STAIRS')).toBe(hardnessOf('PLANKS'))
    expect(hardnessOf('CAULDRON')).toBe(hardnessOf('PLANKS'))
    expect(hardnessOf('WATER_CAULDRON')).toBe(hardnessOf('CAULDRON'))
    expect(hardnessOf('FURNACE')).toBeGreaterThan(hardnessOf('DEEPSLATE'))
    expect(hardnessOf('FURNACE')).toBeLessThan(hardnessOf('OBSIDIAN'))
    expect(hardnessOf('ANVIL')).toBeGreaterThan(hardnessOf('FURNACE'))
    expect(hardnessOf('ANVIL')).toBeLessThan(hardnessOf('BEDROCK'))
  })
})

// ---------------------------------------------------------------------------
// Config split correctness
// ---------------------------------------------------------------------------

describe('config split correctness', () => {
  it('terrainBlocks + oreAndMineralBlocks + craftedAndItemBlocks + endBlocks equals initialBlocks length', () => {
    const sum = terrainBlocks.length + oreAndMineralBlocks.length + craftedAndItemBlocks.length + endBlocks.length
    expect(sum).toBe(initialBlocks.length)
  })
})

describe('getOreXpDrop', () => {
  it('does not classify non-ore blocks as ore XP blocks', () => {
    expect(isOreXpBlock('STONE')).toBe(false)
    expect(isOreXpBlock('DIRT')).toBe(false)
    expect(Option.isNone(getOreXpDropOption('STONE'))).toBe(true)
    expect(Option.isNone(getOreXpDropOption('DIRT'))).toBe(true)
  })

  it('returns 0 for iron and gold ore (XP from smelting, not breaking)', () => {
    expect(getOreXpDrop('IRON_ORE')).toBe(0)
    expect(getOreXpDrop('DEEPSLATE_IRON_ORE')).toBe(0)
    expect(getOreXpDrop('GOLD_ORE')).toBe(0)
    expect(getOreXpDrop('DEEPSLATE_GOLD_ORE')).toBe(0)
  })

  it('returns 5 for coal and redstone ore', () => {
    expect(getOreXpDrop('COAL_ORE')).toBe(5)
    expect(getOreXpDrop('DEEPSLATE_COAL_ORE')).toBe(5)
    expect(getOreXpDrop('REDSTONE_ORE')).toBe(5)
    expect(getOreXpDrop('DEEPSLATE_REDSTONE_ORE')).toBe(5)
    expect(getOreXpDrop('LAPIS_ORE')).toBe(5)
    expect(getOreXpDrop('DEEPSLATE_LAPIS_ORE')).toBe(5)
  })

  it('returns 7 for diamond and emerald ore', () => {
    expect(getOreXpDrop('DIAMOND_ORE')).toBe(7)
    expect(getOreXpDrop('DEEPSLATE_DIAMOND_ORE')).toBe(7)
    expect(getOreXpDrop('EMERALD_ORE')).toBe(7)
    expect(getOreXpDrop('DEEPSLATE_EMERALD_ORE')).toBe(7)
  })

  it('deepslate variants match their surface ore XP', () => {
    const orePairs = [
      ['DEEPSLATE_COAL_ORE', 'COAL_ORE'],
      ['DEEPSLATE_DIAMOND_ORE', 'DIAMOND_ORE'],
      ['DEEPSLATE_EMERALD_ORE', 'EMERALD_ORE'],
      ['DEEPSLATE_LAPIS_ORE', 'LAPIS_ORE'],
      ['DEEPSLATE_REDSTONE_ORE', 'REDSTONE_ORE'],
    ] as const
    for (const [deepslateOre, surfaceOre] of orePairs) {
      expect(getOreXpDrop(deepslateOre)).toBe(getOreXpDrop(surfaceOre))
    }
  })
})
