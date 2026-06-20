import { Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex, blockTypeToIndex } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world/domain/chunk'
import { candidateAt, clampAboveWater, findFallbackSurfaceY, scoreSpawnCandidate } from '@ts-minecraft/app/main/spawn-selection-search'

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

describe('spawn-selection search helpers', () => {
  it('scores openness ahead of distance', () => {
    expect(scoreSpawnCandidate({ openness: 12, distanceSq: 400 })).toBeGreaterThan(
      scoreSpawnCandidate({ openness: 11, distanceSq: 1 }),
    )
  })

  it('rejects surface candidates without sky-visible headroom', () => {
    const chunk = emptyChunk()
    fillColumn(chunk, 8, 8, 0, 64, DIRT)
    setBlock(chunk, 8, 65, 8, LEAVES)

    const candidate = candidateAt(new Map([['0,0', chunk]]), { x: 8.5, z: 8.5 }, 8, 8)

    expect(Option.isNone(candidate)).toBe(true)
  })

  it('selects the nearest dry fallback column over wet ground', () => {
    const dry = emptyChunk(0, 0)
    fillColumn(dry, 2, 2, 0, 64, STONE)
    const wet = emptyChunk(1, 0)
    fillColumn(wet, 2, 2, 0, 63, WATER)
    fillColumn(wet, 2, 2, 64, 64, STONE)

    const y = findFallbackSurfaceY(new Map([
      ['0,0', wet],
      ['1,0', dry],
    ]), { x: 2.5, z: 2.5 })

    expect(y).toBe(65.9)
  })

  it('clamps submerged spawn bodies above the water line', () => {
    expect(clampAboveWater({ position: { x: 1, y: 63, z: 2 }, yaw: 0 }).position.y).toBe(64.9)
  })
})
