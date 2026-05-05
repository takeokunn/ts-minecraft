import { describe, it, expect } from 'vitest'
import { Array as Arr, Option } from 'effect'
import { Schema } from 'effect'
import { BlockTypeSchema } from '@ts-minecraft/kernel'
import { initialBlocks } from '@ts-minecraft/world-state'
import { terrainBlocks } from '../domain/blocks.config.terrain'
import { oreAndMineralBlocks } from '../domain/blocks.config.ores'
import { craftedAndItemBlocks } from '../domain/blocks.config.crafted'

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
})

// ---------------------------------------------------------------------------
// Config split correctness
// ---------------------------------------------------------------------------

describe('config split correctness', () => {
  it('terrainBlocks + oreAndMineralBlocks + craftedAndItemBlocks equals initialBlocks length', () => {
    const sum = terrainBlocks.length + oreAndMineralBlocks.length + craftedAndItemBlocks.length
    expect(sum).toBe(initialBlocks.length)
  })
})
