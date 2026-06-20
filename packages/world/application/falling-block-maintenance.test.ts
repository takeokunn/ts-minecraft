import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'

import { runFallingBlockMaintenance } from './falling-block-maintenance'
import { makeGrowthChunk, setGrowthChunkBlock } from '../test/plant-growth-test-kit'

describe('runFallingBlockMaintenance', () => {
  it('moves unsupported sand one block down', () => {
    const chunk = makeGrowthChunk({ x: 2, z: -1 })
    setGrowthChunkBlock(chunk, 3, 10, 4, 'SAND')
    const forceSetBlock = vi.fn(() => Effect.void)

    Effect.runSync(runFallingBlockMaintenance({
      blockService: { forceSetBlock },
      chunkManagerService: { getLoadedChunks: () => Effect.succeed([chunk]) },
    }))

    expect(forceSetBlock).toHaveBeenCalledTimes(2)
    expect(forceSetBlock).toHaveBeenNthCalledWith(1, { x: 35, y: 10, z: -12 }, 'AIR')
    expect(forceSetBlock).toHaveBeenNthCalledWith(2, { x: 35, y: 9, z: -12 }, 'SAND')
  })

  it('does not move gravel when it is supported', () => {
    const chunk = makeGrowthChunk()
    setGrowthChunkBlock(chunk, 1, 10, 1, 'GRAVEL')
    setGrowthChunkBlock(chunk, 1, 9, 1, 'STONE')
    const forceSetBlock = vi.fn(() => Effect.void)

    Effect.runSync(runFallingBlockMaintenance({
      blockService: { forceSetBlock },
      chunkManagerService: { getLoadedChunks: () => Effect.succeed([chunk]) },
    }))

    expect(forceSetBlock).not.toHaveBeenCalled()
  })

  it('does not move sand at the bottom of the world', () => {
    const chunk = makeGrowthChunk()
    setGrowthChunkBlock(chunk, 1, 0, 1, 'SAND')
    const forceSetBlock = vi.fn(() => Effect.void)

    Effect.runSync(runFallingBlockMaintenance({
      blockService: { forceSetBlock },
      chunkManagerService: { getLoadedChunks: () => Effect.succeed([chunk]) },
    }))

    expect(forceSetBlock).not.toHaveBeenCalled()
  })
})
