import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex, blockTypeToIndex } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world/domain/chunk'
import { selectSurfaceSpawn } from '@ts-minecraft/app/main/spawn-selection'

const AIR = blockTypeToIndex('AIR')
const DIRT = blockTypeToIndex('DIRT')
const STONE = blockTypeToIndex('STONE')
const WATER = blockTypeToIndex('WATER')
const LEAVES = blockTypeToIndex('LEAVES')

const emptyChunk = (x = 0, z = 0): Chunk => ({
  coord: { x, z },
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
  fluid: Option.none(),
})

const setBlock = (chunk: Chunk, x: number, y: number, z: number, type: number) => {
  chunk.blocks[Option.getOrThrow(blockIndex(x, y, z))] = type
}

const fillColumn = (chunk: Chunk, x: number, z: number, fromY: number, toY: number, type: number) => {
  for (let y = fromY; y <= toY; y++) setBlock(chunk, x, y, z, type)
}

describe('selectSurfaceSpawn', () => {
  it('selects a sky-visible surface spawn centered over solid ground', () => {
    const chunk = emptyChunk()
    fillColumn(chunk, 8, 8, 0, 70, DIRT)

    const spawn = selectSurfaceSpawn([chunk], { x: 8.5, y: 100, z: 8.5 })

    expect(spawn.position).toEqual({ x: 8.5, y: 71.9, z: 8.5 })
    expect(spawn.yaw).toBe(0)
  })

  it('rejects water columns and chooses nearby solid dry ground', () => {
    const chunk = emptyChunk()
    fillColumn(chunk, 8, 8, 0, 70, WATER)
    fillColumn(chunk, 9, 8, 0, 66, STONE)

    const spawn = selectSurfaceSpawn([chunk], { x: 8, y: 100, z: 8 })

    expect(spawn.position.x).toBe(9.5)
    expect(spawn.position.z).toBe(8.5)
    expect(spawn.position.y).toBe(67.9)
  })

  it('rejects columns with a block canopy above the headroom', () => {
    const chunk = emptyChunk()
    fillColumn(chunk, 8, 8, 0, 64, DIRT)
    setBlock(chunk, 8, 70, 8, LEAVES)
    fillColumn(chunk, 9, 8, 0, 62, DIRT)

    const spawn = selectSurfaceSpawn([chunk], { x: 8.5, y: 100, z: 8.5 })

    expect(spawn.position.x).toBe(9.5)
    expect(spawn.position.y).toBe(63.9)
  })

  it('returns a valid yaw for the selected spawn position', () => {
    const chunk = emptyChunk()
    fillColumn(chunk, 8, 8, 0, 64, DIRT)
    fillColumn(chunk, 9, 8, 65, 70, STONE)
    fillColumn(chunk, 7, 8, 65, 70, STONE)
    fillColumn(chunk, 8, 7, 65, 70, STONE)

    const spawn = selectSurfaceSpawn([chunk], { x: 8.5, y: 100, z: 8.5 })
    // Yaw should be a finite number (0, ±π/2, or π).
    expect(Number.isFinite(spawn.yaw)).toBe(true)
  })

  it('falls back safely when no valid surface exists', () => {
    const chunk = emptyChunk()
    chunk.blocks.fill(AIR)

    const spawn = selectSurfaceSpawn([chunk], { x: 1, y: 100, z: 2 })

    expect(spawn.position).toEqual({ x: 1, y: 67.9, z: 2 })
    expect(spawn.yaw).toBe(0)
  })

  it('rejects enclosed cave-surface positions when an open-surface candidate exists', () => {
    // Create two candidates: (8,8) with walls reducing total openness,
    // and (14,14) as a wide-open plains column. The open column should win.
    const chunk = emptyChunk()
    // Enclosed (8,8): walls in adjacent columns reduce total openness
    fillColumn(chunk, 8, 8, 0, 60, DIRT)
    fillColumn(chunk, 9, 8, 61, 70, STONE)
    fillColumn(chunk, 7, 8, 61, 70, STONE)
    fillColumn(chunk, 8, 7, 61, 70, STONE)
    // Open (14,14): no adjacent walls, maximum total openness
    fillColumn(chunk, 14, 14, 0, 63, DIRT)

    const spawn = selectSurfaceSpawn([chunk], { x: 8.5, y: 100, z: 8.5 })

    // The spawn should NOT be at the enclosed (8,8) position.
    expect(spawn.position.x).not.toBe(8.5)
    // And it should be at a column with high total openness.
    expect(spawn.position.y).toBeGreaterThan(61)   // surface-level spawn, not cave floor
  })
})
