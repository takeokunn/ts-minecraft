import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import { CHUNK_SIZE, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT } from '@ts-minecraft/core'
import { worldToBlockLocal, canHarvestBlock, blockOverlapsPlayer } from './block-utils'

describe('worldToBlockLocal', () => {
  it('origin returns chunk (0,0) with local coords (0, 0)', () => {
    const { chunkCoord, lx, lz } = worldToBlockLocal({ x: 0, y: 64, z: 0 })
    expect(chunkCoord).toEqual({ x: 0, z: 0 })
    expect(lx).toBe(0)
    expect(lz).toBe(0)
  })

  it('position at CHUNK_SIZE goes to chunk (1, 0)', () => {
    const { chunkCoord, lx } = worldToBlockLocal({ x: CHUNK_SIZE, y: 64, z: 0 })
    expect(chunkCoord).toEqual({ x: 1, z: 0 })
    expect(lx).toBe(0)
  })

  it('negative x wraps local coords to [0, CHUNK_SIZE)', () => {
    const { chunkCoord, lx } = worldToBlockLocal({ x: -1, y: 64, z: 0 })
    expect(chunkCoord).toEqual({ x: -1, z: 0 })
    expect(lx).toBe(CHUNK_SIZE - 1)
  })

  it('local coords are always in [0, CHUNK_SIZE)', () => {
    for (const x of [-32, -16, -1, 0, 7, 15, 16, 32, 100]) {
      const { lx } = worldToBlockLocal({ x, y: 64, z: 0 })
      expect(lx).toBeGreaterThanOrEqual(0)
      expect(lx).toBeLessThan(CHUNK_SIZE)
    }
  })
})

describe('canHarvestBlock', () => {
  it('no tool: can harvest non-pickaxe-required block (e.g. DIRT)', () => {
    expect(canHarvestBlock('DIRT', Option.none())).toBe(true)
  })

  it('no tool: cannot harvest pickaxe-required block (e.g. STONE)', () => {
    expect(canHarvestBlock('STONE', Option.none())).toBe(false)
  })

  it('no tool: cannot harvest diamond-only block (e.g. OBSIDIAN)', () => {
    expect(canHarvestBlock('OBSIDIAN', Option.none())).toBe(false)
  })

  it('WOODEN_PICKAXE: can harvest STONE', () => {
    expect(canHarvestBlock('STONE', Option.some('WOODEN_PICKAXE'))).toBe(true)
  })

  it('WOODEN_PICKAXE: cannot harvest OBSIDIAN (diamond-only)', () => {
    expect(canHarvestBlock('OBSIDIAN', Option.some('WOODEN_PICKAXE'))).toBe(false)
  })

  it('DIAMOND_PICKAXE: can harvest OBSIDIAN', () => {
    expect(canHarvestBlock('OBSIDIAN', Option.some('DIAMOND_PICKAXE'))).toBe(true)
  })

  it('non-pickaxe tool (e.g. WOODEN_SWORD): behaves like no tool for STONE', () => {
    const withSword = canHarvestBlock('STONE', Option.some('WOODEN_SWORD'))
    const withNoTool = canHarvestBlock('STONE', Option.none())
    expect(withSword).toBe(withNoTool)
  })

  it('non-pickaxe tool: can harvest non-pickaxe-required blocks', () => {
    expect(canHarvestBlock('DIRT', Option.some('WOODEN_SWORD'))).toBe(true)
  })

  it('IRON_PICKAXE: can harvest blocks not reachable by STONE_PICKAXE', () => {
    expect(canHarvestBlock('REDSTONE_ORE', Option.some('IRON_PICKAXE'))).toBe(true)
    expect(canHarvestBlock('REDSTONE_ORE', Option.some('STONE_PICKAXE'))).toBe(false)
  })
})

describe('blockOverlapsPlayer', () => {
  const playerFeet = { x: 0, y: 64, z: 0 }

  it('block at same horizontal position and right vertical range overlaps', () => {
    expect(blockOverlapsPlayer(playerFeet, playerFeet)).toBe(true)
  })

  it('block far away does not overlap', () => {
    expect(blockOverlapsPlayer({ x: 100, y: 64, z: 100 }, playerFeet)).toBe(false)
  })

  it('block directly above player head does not overlap', () => {
    const blockAbove = { x: 0, y: playerFeet.y + 2 * PLAYER_HALF_HEIGHT + 2, z: 0 }
    expect(blockOverlapsPlayer(blockAbove, playerFeet)).toBe(false)
  })

  it('block below player feet does not overlap', () => {
    const blockBelow = { x: 0, y: playerFeet.y - 2, z: 0 }
    expect(blockOverlapsPlayer(blockBelow, playerFeet)).toBe(false)
  })

  it('block just outside x range does not overlap', () => {
    const blockSide = { x: playerFeet.x + PLAYER_HALF_WIDTH * 2 + 1, y: playerFeet.y, z: 0 }
    expect(blockOverlapsPlayer(blockSide, playerFeet)).toBe(false)
  })
})
