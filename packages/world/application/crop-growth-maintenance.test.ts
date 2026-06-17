import { Effect, MutableRef } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { blockTypeToIndex, type BlockType } from '@ts-minecraft/core'
import { makeChunkBlockBuffer } from '../test/chunk-buffer-test-utils'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'
import { runCropGrowthMaintenance } from './crop-growth-maintenance'

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

describe('crop growth maintenance', () => {
  it('only advances the accumulator below the crop interval', () => {
    const tickAll = vi.fn(() => Effect.void)
    const getLoadedChunks = vi.fn(() => Effect.succeed([makeChunk()]))
    const forceSetBlock = vi.fn(() => Effect.void)
    const cropTickAccumulatorRef = MutableRef.make(0.25)

    Effect.runSync(runCropGrowthMaintenance(
      {
        blockService: { forceSetBlock },
        chunkManagerService: { getLoadedChunks },
        cropGrowthService: { tickAll },
      },
      { cropTickAccumulatorRef },
      0.5,
    ))

    expect(MutableRef.get(cropTickAccumulatorRef)).toBe(0.75)
    expect(tickAll).not.toHaveBeenCalled()
    expect(getLoadedChunks).not.toHaveBeenCalled()
    expect(forceSetBlock).not.toHaveBeenCalled()
  })

  it('ticks crops and spreads grass when the crop interval is reached', () => {
    const chunk = makeChunk({ x: 2, z: -1 })
    setBlock(chunk, 3, 10, 5, 'GRASS')
    setBlock(chunk, 4, 10, 5, 'DIRT')

    const tickAll = vi.fn(() => Effect.void)
    const getLoadedChunks = vi.fn(() => Effect.succeed([chunk]))
    const forceSetBlock = vi.fn(() => Effect.void)
    const cropTickAccumulatorRef = MutableRef.make(59.75)

    Effect.runSync(runCropGrowthMaintenance(
      {
        blockService: { forceSetBlock },
        chunkManagerService: { getLoadedChunks },
        cropGrowthService: { tickAll },
      },
      { cropTickAccumulatorRef },
      0.5,
    ))

    expect(MutableRef.get(cropTickAccumulatorRef)).toBe(0.25)
    expect(tickAll).toHaveBeenCalledTimes(1)
    expect(getLoadedChunks).toHaveBeenCalledTimes(1)
    expect(forceSetBlock).toHaveBeenCalledTimes(1)
    expect(forceSetBlock).toHaveBeenCalledWith({ x: 36, y: 10, z: -11 }, 'GRASS')
  })
})
