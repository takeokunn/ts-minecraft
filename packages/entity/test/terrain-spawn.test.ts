import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/world'
import { LIGHT_BYTE_LENGTH, setLightAt } from '@ts-minecraft/block/domain/light'
// chunkBlockIndexUnchecked is used for setBlock helper below
import { resolveMobSpawnPosition } from '@ts-minecraft/entity/domain/mob/terrain-spawn'
import type { Chunk } from '@ts-minecraft/world/domain/chunk'
import { MOB_HALF_HEIGHT, HOSTILE_SPAWN_MAX_BLOCK_LIGHT } from '@ts-minecraft/entity/domain/mob/spawner-config'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const makeEmptyChunk = (blockLight?: Uint8Array): Chunk => ({
  coord: { x: 0, z: 0 },
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
  fluid: Option.none(),
  ...(blockLight !== undefined ? { blockLight } : {}),
})

const setBlock = (chunk: Chunk, lx: number, y: number, lz: number, blockId: number): void => {
  const idx = chunkBlockIndexUnchecked(lx, y, lz)
  ;(chunk.blocks as Uint8Array)[idx] = blockId
}

// ─── resolveMobSpawnPosition ──────────────────────────────────────────────────
describe('resolveMobSpawnPosition', () => {
  it('returns None for an all-air chunk (no solid surface)', () => {
    const chunk = makeEmptyChunk()
    const result = resolveMobSpawnPosition(chunk, { x: 0, y: 64, z: 0 })
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns a spawn position above the top solid block', () => {
    const chunk = makeEmptyChunk()
    setBlock(chunk, 0, 60, 0, 1) // stone at y=60
    const result = resolveMobSpawnPosition(chunk, { x: 0, y: 64, z: 0 })
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      // body block at y=61; mob centre = 61 + MOB_HALF_HEIGHT
      expect(result.value.y).toBeCloseTo(61 + MOB_HALF_HEIGHT)
    }
  })

  it('preserves the candidate x and z coordinates', () => {
    const chunk = makeEmptyChunk()
    setBlock(chunk, 3, 50, 5, 1)
    const result = resolveMobSpawnPosition(chunk, { x: 3, y: 64, z: 5 })
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.x).toBe(3)
      expect(result.value.z).toBe(5)
    }
  })

  it('returns None when head block would exceed CHUNK_HEIGHT', () => {
    const chunk = makeEmptyChunk()
    // surface at CHUNK_HEIGHT - 2, body at CHUNK_HEIGHT - 1, head at CHUNK_HEIGHT → invalid
    setBlock(chunk, 0, CHUNK_HEIGHT - 2, 0, 1)
    const result = resolveMobSpawnPosition(chunk, { x: 0, y: 64, z: 0 })
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns None for hostile spawn at a well-lit surface', () => {
    const lightGrid = new Uint8Array(LIGHT_BYTE_LENGTH)
    // body voxel is at y=61 (surface at y=60 → bodyBlockY = 61)
    setLightAt(lightGrid, 0, 61, 0, HOSTILE_SPAWN_MAX_BLOCK_LIGHT + 1)
    const chunk = makeEmptyChunk(lightGrid)
    setBlock(chunk, 0, 60, 0, 1)
    const result = resolveMobSpawnPosition(chunk, { x: 0, y: 64, z: 0 }, true)
    expect(Option.isNone(result)).toBe(true)
  })

  it('allows hostile spawn when block light is at the threshold', () => {
    const lightGrid = new Uint8Array(LIGHT_BYTE_LENGTH)
    setLightAt(lightGrid, 0, 61, 0, HOSTILE_SPAWN_MAX_BLOCK_LIGHT)
    const chunk = makeEmptyChunk(lightGrid)
    setBlock(chunk, 0, 60, 0, 1)
    const result = resolveMobSpawnPosition(chunk, { x: 0, y: 64, z: 0 }, true)
    expect(Option.isSome(result)).toBe(true)
  })

  it('allows hostile spawn in dark conditions (no blockLight grid)', () => {
    const chunk = makeEmptyChunk()
    setBlock(chunk, 0, 60, 0, 1)
    // blockLight undefined → treated as 0 (dark) → spawn allowed
    const result = resolveMobSpawnPosition(chunk, { x: 0, y: 64, z: 0 }, true)
    expect(Option.isSome(result)).toBe(true)
  })

  it('uses modular local coordinates for negative world positions', () => {
    const chunk = makeEmptyChunk()
    // world x=-1 → lx = ((-1 % 16) + 16) % 16 = 15
    setBlock(chunk, 15, 50, 0, 1)
    const result = resolveMobSpawnPosition(chunk, { x: -1, y: 64, z: 0 })
    expect(Option.isSome(result)).toBe(true)
  })
})

describe('aquatic spawn resolution (deep water)', () => {
  const WATER = blockTypeToIndex('WATER')
  const STONE = 1

  const makeOceanColumn = (floorY: number, surfaceY: number): Chunk => {
    const chunk = makeEmptyChunk()
    setBlock(chunk, 0, floorY, 0, STONE)
    for (let y = floorY + 1; y <= surfaceY; y++) setBlock(chunk, 0, y, 0, WATER)
    return chunk
  }

  it('deep water resolves a SUBMERGED position flagged aquatic', () => {
    const chunk = makeOceanColumn(50, 62) // 12 blocks of water
    const result = resolveMobSpawnPosition(chunk, { x: 0, y: 64, z: 0 })
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.aquatic).toBe(true)
      // one block below the surface, inside the water column
      expect(result.value.y).toBeCloseTo(61 + MOB_HALF_HEIGHT)
    }
  })

  it('shallow water (a pond) keeps the legacy surface spawn without the flag', () => {
    const chunk = makeOceanColumn(60, 61) // 1 block of water
    const result = resolveMobSpawnPosition(chunk, { x: 0, y: 64, z: 0 })
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.aquatic).toBeUndefined()
      expect(result.value.y).toBeCloseTo(62 + MOB_HALF_HEIGHT)
    }
  })

  it('hostile light gate does not apply underwater (depths are dark)', () => {
    const chunk = makeOceanColumn(50, 62)
    const result = resolveMobSpawnPosition(chunk, { x: 0, y: 64, z: 0 }, true)
    expect(Option.isSome(result)).toBe(true)
  })
})
