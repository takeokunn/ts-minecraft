import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import { CHUNK_HEIGHT } from '@ts-minecraft/core'
import { createLightBuffer, setLightAt } from '@ts-minecraft/block'
import { resolveMobSpawnPosition, MOB_HALF_HEIGHT, HOSTILE_SPAWN_MAX_BLOCK_LIGHT } from '@ts-minecraft/entity'
import { expectSome, makeTerrainChunk } from './test-utils'

// ─── helpers ──────────────────────────────────────────────────────────────────

const pos = (x: number, z: number) => ({ x, y: 0, z })

// ─── tests ────────────────────────────────────────────────────────────────────

describe('resolveMobSpawnPosition', () => {
  it('returns Some with the correct y for a clear column above a stone surface', () => {
    const chunk = makeTerrainChunk([{ lx: 0, y: 64, lz: 0, blockType: 'STONE' }])

    const result = resolveMobSpawnPosition(chunk, pos(0, 0))

    const { x, y, z } = expectSome(result)
    expect(x).toBe(0)
    expect(y).toBeCloseTo(65 + MOB_HALF_HEIGHT)
    expect(z).toBe(0)
  })

  it('returns None when the column is all air', () => {
    const chunk = makeTerrainChunk()
    expect(Option.isNone(resolveMobSpawnPosition(chunk, pos(4, 4)))).toBe(true)
  })

  it('returns None when surface is at the top of the chunk (no room for head)', () => {
    // surfaceY = CHUNK_HEIGHT-1 → headBlockY = CHUNK_HEIGHT+1 ≥ CHUNK_HEIGHT
    const chunk = makeTerrainChunk([{ lx: 0, y: CHUNK_HEIGHT - 1, lz: 0, blockType: 'STONE' }])
    expect(Option.isNone(resolveMobSpawnPosition(chunk, pos(0, 0)))).toBe(true)
  })

  it('non-hostile spawn: allows light area (returns Some regardless of light)', () => {
    const blockLight = createLightBuffer()
    setLightAt(blockLight, 1, 61, 1, 15) // maximum light
    const chunk = makeTerrainChunk([{ lx: 1, y: 60, lz: 1, blockType: 'STONE' }], { blockLight })

    expectSome(resolveMobSpawnPosition(chunk, pos(1, 1), false))
  })

  it('hostile spawn: returns None when block light at body voxel exceeds threshold', () => {
    const blockLight = createLightBuffer()
    setLightAt(blockLight, 1, 61, 1, HOSTILE_SPAWN_MAX_BLOCK_LIGHT + 1)
    const chunk = makeTerrainChunk([{ lx: 1, y: 60, lz: 1, blockType: 'STONE' }], { blockLight })

    expect(Option.isNone(resolveMobSpawnPosition(chunk, pos(1, 1), true))).toBe(true)
  })

  it('hostile spawn: returns Some when block light is exactly at threshold', () => {
    const blockLight = createLightBuffer()
    setLightAt(blockLight, 1, 61, 1, HOSTILE_SPAWN_MAX_BLOCK_LIGHT)
    const chunk = makeTerrainChunk([{ lx: 1, y: 60, lz: 1, blockType: 'STONE' }], { blockLight })

    expectSome(resolveMobSpawnPosition(chunk, pos(1, 1), true))
  })

  it('hostile spawn with no blockLight grid: reads as 0 (dark) → Some', () => {
    const chunk = makeTerrainChunk([{ lx: 2, y: 70, lz: 2, blockType: 'STONE' }]) // no blockLight field

    expectSome(resolveMobSpawnPosition(chunk, pos(2, 2), true))
  })

  it('uses modular local coordinates for world positions outside chunk (lx/lz wrap)', () => {
    // candidatePosition.x=16 → lx = (16 % 16 + 16) % 16 = 0
    const chunk = makeTerrainChunk([{ lx: 0, y: 50, lz: 0, blockType: 'STONE' }])

    const result = resolveMobSpawnPosition(chunk, { x: 16, y: 0, z: 0 })
    expectSome(result)
  })
})
