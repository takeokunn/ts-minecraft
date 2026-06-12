import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/world'
import { createLightBuffer, setLightAt } from '@ts-minecraft/block'
import { resolveMobSpawnPosition, MOB_HALF_HEIGHT, HOSTILE_SPAWN_MAX_BLOCK_LIGHT } from '@ts-minecraft/entity'
import type { Chunk } from '@ts-minecraft/world'

// ─── helpers ──────────────────────────────────────────────────────────────────

const STONE = blockTypeToIndex('STONE')

const makeChunk = (overrides: Partial<Chunk> = {}): Chunk => ({
  coord: { x: 0, z: 0 },
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE),
  fluid: Option.none(),
  ...overrides,
})

/** Sets block at local (lx, y, lz) in a fresh chunk's blocks array. */
const placeBlock = (blocks: Uint8Array, lx: number, y: number, lz: number, blockId: number): void => {
  blocks[chunkBlockIndexUnchecked(lx, y, lz)] = blockId
}

const pos = (x: number, z: number) => ({ x, y: 0, z })

// ─── tests ────────────────────────────────────────────────────────────────────

describe('resolveMobSpawnPosition', () => {
  it('returns Some with the correct y for a clear column above a stone surface', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
    placeBlock(blocks, 0, 64, 0, STONE)
    const chunk = makeChunk({ blocks })

    const result = resolveMobSpawnPosition(chunk, pos(0, 0))

    expect(Option.isSome(result)).toBe(true)
    const { x, y, z } = Option.getOrThrow(result)
    expect(x).toBe(0)
    expect(y).toBeCloseTo(65 + MOB_HALF_HEIGHT)
    expect(z).toBe(0)
  })

  it('returns None when the column is all air', () => {
    const chunk = makeChunk()
    expect(Option.isNone(resolveMobSpawnPosition(chunk, pos(4, 4)))).toBe(true)
  })

  it('returns None when surface is at the top of the chunk (no room for head)', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
    // surfaceY = CHUNK_HEIGHT-1 → headBlockY = CHUNK_HEIGHT+1 ≥ CHUNK_HEIGHT
    placeBlock(blocks, 0, CHUNK_HEIGHT - 1, 0, STONE)
    const chunk = makeChunk({ blocks })
    expect(Option.isNone(resolveMobSpawnPosition(chunk, pos(0, 0)))).toBe(true)
  })

  it('non-hostile spawn: allows light area (returns Some regardless of light)', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
    placeBlock(blocks, 1, 60, 1, STONE)
    const blockLight = createLightBuffer()
    setLightAt(blockLight, 1, 61, 1, 15) // maximum light
    const chunk = makeChunk({ blocks, blockLight })

    expect(Option.isSome(resolveMobSpawnPosition(chunk, pos(1, 1), false))).toBe(true)
  })

  it('hostile spawn: returns None when block light at body voxel exceeds threshold', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
    placeBlock(blocks, 1, 60, 1, STONE)
    const blockLight = createLightBuffer()
    setLightAt(blockLight, 1, 61, 1, HOSTILE_SPAWN_MAX_BLOCK_LIGHT + 1)
    const chunk = makeChunk({ blocks, blockLight })

    expect(Option.isNone(resolveMobSpawnPosition(chunk, pos(1, 1), true))).toBe(true)
  })

  it('hostile spawn: returns Some when block light is exactly at threshold', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
    placeBlock(blocks, 1, 60, 1, STONE)
    const blockLight = createLightBuffer()
    setLightAt(blockLight, 1, 61, 1, HOSTILE_SPAWN_MAX_BLOCK_LIGHT)
    const chunk = makeChunk({ blocks, blockLight })

    expect(Option.isSome(resolveMobSpawnPosition(chunk, pos(1, 1), true))).toBe(true)
  })

  it('hostile spawn with no blockLight grid: reads as 0 (dark) → Some', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
    placeBlock(blocks, 2, 70, 2, STONE)
    const chunk = makeChunk({ blocks }) // no blockLight field

    expect(Option.isSome(resolveMobSpawnPosition(chunk, pos(2, 2), true))).toBe(true)
  })

  it('uses modular local coordinates for world positions outside chunk (lx/lz wrap)', () => {
    // candidatePosition.x=16 → lx = (16 % 16 + 16) % 16 = 0
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
    placeBlock(blocks, 0, 50, 0, STONE) // local (0,50,0)
    const chunk = makeChunk({ blocks })

    const result = resolveMobSpawnPosition(chunk, { x: 16, y: 0, z: 0 })
    expect(Option.isSome(result)).toBe(true)
  })
})
