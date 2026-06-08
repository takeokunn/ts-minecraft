import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Option } from 'effect'
import { Schema } from 'effect'
import { BlockTypeSchema } from '@ts-minecraft/core'
import { initialBlocks } from '@ts-minecraft/block'
import { terrainBlocks } from '../domain/blocks.config.terrain'
import { oreAndMineralBlocks } from '../domain/blocks.config.ores'
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
    expect(hardnessOf('DIRT')).toBeLessThan(hardnessOf('STONE'))
    expect(hardnessOf('SAND')).toBeLessThan(hardnessOf('STONE'))
    expect(hardnessOf('GRASS')).toBeLessThan(hardnessOf('STONE'))
    // Stone-family share stone's hardness; wood (2.0) and deepslate (3.0) are harder than stone (1.5).
    expect(hardnessOf('GRANITE')).toBe(hardnessOf('STONE'))
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
    expect(hardnessOf('FURNACE')).toBeGreaterThan(hardnessOf('DEEPSLATE'))
    expect(hardnessOf('FURNACE')).toBeLessThan(hardnessOf('OBSIDIAN'))
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
