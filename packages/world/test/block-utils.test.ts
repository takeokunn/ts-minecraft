import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import type { InventoryItem, Position } from '@ts-minecraft/core'
import { worldToBlockLocal, canHarvestBlock, isEffectiveTool, blockOverlapsPlayer } from '../domain/block-utils'

const pos = (x: number, y: number, z: number): Position => ({ x, y, z })

describe('worldToBlockLocal', () => {
  it('maps positive coordinates to the chunk at the origin', () => {
    const { chunkCoord, lx, lz, y } = worldToBlockLocal(pos(5, 12.8, 9))
    expect(chunkCoord).toEqual({ x: 0, z: 0 })
    expect(lx).toBe(5)
    expect(lz).toBe(9)
    expect(y).toBe(12)
  })

  it('maps coordinates at a chunk boundary to the next chunk', () => {
    const { chunkCoord, lx, lz } = worldToBlockLocal(pos(16, 0, 32))
    expect(chunkCoord).toEqual({ x: 1, z: 2 })
    expect(lx).toBe(0)
    expect(lz).toBe(0)
  })

  it('handles negative coordinates with the double-modulo idiom (no negative locals)', () => {
    // -1 lands in chunk -1 at local index 15, NOT chunk 0 index -1
    const { chunkCoord, lx, lz } = worldToBlockLocal(pos(-1, 0, -1))
    expect(chunkCoord).toEqual({ x: -1, z: -1 })
    expect(lx).toBe(15)
    expect(lz).toBe(15)
  })

  it('keeps local indices within [0, CHUNK_SIZE) for a sweep of world x', () => {
    for (let x = -40; x <= 40; x++) {
      const { lx } = worldToBlockLocal(pos(x + 0.7, 0, 0))
      expect(lx).toBeGreaterThanOrEqual(0)
      expect(lx).toBeLessThan(16)
    }
  })

  it('floors fractional coordinates before computing the block index', () => {
    const { lx, lz, y } = worldToBlockLocal(pos(3.9, 4.99, 7.2))
    expect(lx).toBe(3)
    expect(lz).toBe(7)
    expect(y).toBe(4)
  })
})

describe('canHarvestBlock', () => {
  const noTool = Option.none<InventoryItem>()
  const tool = (item: InventoryItem) => Option.some(item)

  it('bare hand can harvest soft blocks (not in any pickaxe set)', () => {
    expect(canHarvestBlock('DIRT', noTool)).toBe(true)
    expect(canHarvestBlock('GRASS', noTool)).toBe(true)
  })

  it('bare hand cannot harvest pickaxe-required blocks (yields no drop)', () => {
    expect(canHarvestBlock('STONE', noTool)).toBe(false)
    expect(canHarvestBlock('OBSIDIAN', noTool)).toBe(false)
  })

  it('a non-pickaxe tool behaves like a bare hand for harvest gating', () => {
    expect(canHarvestBlock('STONE', tool('WOODEN_SWORD'))).toBe(false)
    expect(canHarvestBlock('DIRT', tool('WOODEN_SWORD'))).toBe(true)
  })

  it('wooden pickaxe harvests stone but not iron ore', () => {
    expect(canHarvestBlock('STONE', tool('WOODEN_PICKAXE'))).toBe(true)
    expect(canHarvestBlock('IRON_ORE', tool('WOODEN_PICKAXE'))).toBe(false)
  })

  it('stone pickaxe harvests iron ore but not diamond ore', () => {
    expect(canHarvestBlock('IRON_ORE', tool('STONE_PICKAXE'))).toBe(true)
    expect(canHarvestBlock('DIAMOND_ORE', tool('STONE_PICKAXE'))).toBe(false)
  })

  it('iron pickaxe harvests diamond ore but not obsidian', () => {
    expect(canHarvestBlock('DIAMOND_ORE', tool('IRON_PICKAXE'))).toBe(true)
    expect(canHarvestBlock('OBSIDIAN', tool('IRON_PICKAXE'))).toBe(false)
  })

  it('only the diamond pickaxe harvests obsidian', () => {
    expect(canHarvestBlock('OBSIDIAN', tool('DIAMOND_PICKAXE'))).toBe(true)
  })
})

describe('blockOverlapsPlayer', () => {
  // Player feet at origin: AABB spans x,z ∈ [-0.3, 0.3], y ∈ [0, 1.8]
  const feet = pos(0, 0, 0)

  it('detects overlap with the block the player stands inside', () => {
    // block at (-1,0,-1) occupies [-1,0]×[0,1]×[-1,0]; its +face touches the player AABB
    expect(blockOverlapsPlayer(pos(-1, 0, -1), feet)).toBe(true)
  })

  it('reports no overlap for a block well outside the player footprint', () => {
    expect(blockOverlapsPlayer(pos(5, 0, 5), feet)).toBe(false)
  })

  it('reports no overlap for a block directly above the player head', () => {
    // player top is y=1.8; a block at y=3 is far above
    expect(blockOverlapsPlayer(pos(0, 3, 0), feet)).toBe(false)
  })

  it('detects overlap with a block at the player feet level', () => {
    expect(blockOverlapsPlayer(pos(0, 0, 0), feet)).toBe(true)
  })

  it('reports no overlap once a side block clears the horizontal half-extent', () => {
    // player x-extent reaches 0.3; block at x=1 spans [1,2], center 1.5 → gap 1.2 > 0.8
    expect(blockOverlapsPlayer(pos(1, 0, 0), feet)).toBe(false)
  })

  it('respects the y-extent boundary: a block exactly one cube below just clears (exclusive)', () => {
    // block at y=-1 has center -0.5; player center 0.9 → gap 1.4 == threshold (0.5+0.9), exclusive → no overlap
    expect(blockOverlapsPlayer(pos(0, -1, 0), feet)).toBe(false)
    // lowering the player feet toward that block brings it into reach
    expect(blockOverlapsPlayer(pos(0, -1, 0), pos(0, -0.1, 0))).toBe(true)
  })
})

describe('isEffectiveTool', () => {
  const noTool = Option.none<InventoryItem>()
  const tool = (item: InventoryItem) => Option.some(item)

  it('a tool is effective on its own category (keeps the speed bonus)', () => {
    expect(isEffectiveTool('STONE', tool('WOODEN_PICKAXE'))).toBe(true)
    expect(isEffectiveTool('IRON_ORE', tool('DIAMOND_PICKAXE'))).toBe(true)
    expect(isEffectiveTool('WOOD', tool('IRON_AXE'))).toBe(true)
    expect(isEffectiveTool('DIRT', tool('STONE_SHOVEL'))).toBe(true)
  })

  it('withholds the bonus on a clear cross-category mismatch', () => {
    expect(isEffectiveTool('DIRT', tool('DIAMOND_PICKAXE'))).toBe(false) // pickaxe on soft ground
    expect(isEffectiveTool('STONE', tool('IRON_SHOVEL'))).toBe(false) // shovel on stone
    expect(isEffectiveTool('STONE', tool('DIAMOND_AXE'))).toBe(false) // axe on stone
    expect(isEffectiveTool('WOOD', tool('STONE_PICKAXE'))).toBe(false) // pickaxe on wood
  })

  it('never penalises blocks outside any category (no regression for e.g. cobblestone)', () => {
    expect(isEffectiveTool('COBBLESTONE', tool('DIAMOND_PICKAXE'))).toBe(true)
    expect(isEffectiveTool('COBBLESTONE', tool('IRON_SHOVEL'))).toBe(true)
  })

  it('bare hand and non-mining tools are never penalised', () => {
    expect(isEffectiveTool('STONE', noTool)).toBe(true)
    expect(isEffectiveTool('DIRT', noTool)).toBe(true)
    expect(isEffectiveTool('STONE', tool('WOODEN_SWORD'))).toBe(true)
  })
})
