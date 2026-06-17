import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { CHUNK_SIZE, blockTypeToIndex, type BlockType } from '@ts-minecraft/core'
import { collectGrassSpreadTargets, GRASS_SPREAD_MAX_PER_TICK, chunkBlockIndexUnchecked } from '@ts-minecraft/world'
import { makeChunkBlockBuffer } from './chunk-buffer-test-utils'

const makeChunk = (coord = { x: 0, z: 0 }) => ({
  coord,
  blocks: makeChunkBlockBuffer(),
})

const setBlock = (
  chunk: ReturnType<typeof makeChunk>,
  localX: number,
  y: number,
  localZ: number,
  blockType: BlockType,
) => {
  chunk.blocks[chunkBlockIndexUnchecked(localX, y, localZ)] = blockTypeToIndex(blockType)
}

const collectTargets = (chunks: Parameters<typeof collectGrassSpreadTargets>[0]) =>
  Effect.runSync(collectGrassSpreadTargets(chunks))

describe('grass spread target collection', () => {
  it('collects dirt with air above and a horizontal grass neighbor', () => {
    const chunk = makeChunk({ x: 2, z: -1 })
    setBlock(chunk, 3, 10, 5, 'GRASS')
    setBlock(chunk, 4, 10, 5, 'DIRT')

    expect(collectTargets([chunk])).toEqual([{ x: 36, y: 10, z: -11 }])
  })

  it('collects dirt with grass on either z side', () => {
    const chunk = makeChunk()
    setBlock(chunk, 5, 12, 4, 'GRASS')
    setBlock(chunk, 5, 12, 5, 'DIRT')
    setBlock(chunk, 8, 12, 9, 'GRASS')
    setBlock(chunk, 8, 12, 8, 'DIRT')

    expect(collectTargets([chunk])).toEqual([
      { x: 5, y: 12, z: 5 },
      { x: 8, y: 12, z: 8 },
    ])
  })

  it('collects dirt with grass on the positive x side', () => {
    const chunk = makeChunk()
    setBlock(chunk, 4, 9, 7, 'DIRT')
    setBlock(chunk, 5, 9, 7, 'GRASS')

    expect(collectTargets([chunk])).toEqual([{ x: 4, y: 9, z: 7 }])
  })

  it('ignores dirt without horizontal grass', () => {
    const chunk = makeChunk()
    setBlock(chunk, 6, 10, 6, 'DIRT')

    expect(collectTargets([chunk])).toEqual([])
  })

  it('ignores dirt at the positive x edge without grass', () => {
    const chunk = makeChunk()
    setBlock(chunk, CHUNK_SIZE - 1, 10, 6, 'DIRT')

    expect(collectTargets([chunk])).toEqual([])
  })

  it('rejects incomplete block buffers instead of treating missing cells as air', () => {
    const chunk = { coord: { x: 0, z: 0 }, blocks: new Uint8Array(0) }

    expect(() => collectTargets([chunk])).toThrow(/complete chunk block buffers/)
  })

  it('does not collect dirt when the block above is occupied', () => {
    const chunk = makeChunk()
    setBlock(chunk, 1, 10, 1, 'GRASS')
    setBlock(chunk, 2, 10, 1, 'DIRT')
    setBlock(chunk, 2, 11, 1, 'STONE')

    expect(collectTargets([chunk])).toEqual([])
  })

  it('caps collected targets to a bounded per-tick budget', () => {
    const chunk = makeChunk()

    for (let localX = 0; localX < CHUNK_SIZE; localX++) {
      for (let localZ = 0; localZ < CHUNK_SIZE; localZ++) {
        setBlock(chunk, localX, 10, localZ, localX % 2 === 0 ? 'GRASS' : 'DIRT')
      }
    }

    expect(collectTargets([chunk])).toHaveLength(GRASS_SPREAD_MAX_PER_TICK)
  })
})
