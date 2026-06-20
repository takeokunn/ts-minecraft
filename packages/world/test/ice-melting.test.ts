import { LIGHT_BYTE_LENGTH, setLightAt } from '@ts-minecraft/block/domain/light'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  ICE_MELT_BLOCK_LIGHT_THRESHOLD,
  ICE_MELT_MAX_PER_TICK,
  collectIceMeltTargets,
} from '@ts-minecraft/world'

import { makeGrowthChunk, setGrowthChunkBlock } from './plant-growth-test-kit'

describe('ice melting domain', () => {
  it('collects ice blocks with block light above the melt threshold', async () => {
    const chunk = makeGrowthChunk({ x: -1, z: 2 })
    chunk.blockLight = new Uint8Array(LIGHT_BYTE_LENGTH)
    setGrowthChunkBlock(chunk, 3, 64, 4, 'ICE')
    setLightAt(chunk.blockLight, 3, 64, 4, ICE_MELT_BLOCK_LIGHT_THRESHOLD + 1)

    const targets = await Effect.runPromise(collectIceMeltTargets([chunk]))

    expect(targets).toEqual([{ x: -13, y: 64, z: 36 }])
  })

  it('does not collect ice blocks at or below the melt threshold', async () => {
    const chunk = makeGrowthChunk()
    chunk.blockLight = new Uint8Array(LIGHT_BYTE_LENGTH)
    setGrowthChunkBlock(chunk, 1, 20, 1, 'ICE')
    setGrowthChunkBlock(chunk, 2, 20, 1, 'ICE')
    setLightAt(chunk.blockLight, 1, 20, 1, ICE_MELT_BLOCK_LIGHT_THRESHOLD)
    setLightAt(chunk.blockLight, 2, 20, 1, ICE_MELT_BLOCK_LIGHT_THRESHOLD - 1)

    const targets = await Effect.runPromise(collectIceMeltTargets([chunk]))

    expect(targets).toEqual([])
  })

  it('ignores ice blocks when block light has not been computed for the chunk', async () => {
    const chunk = makeGrowthChunk()
    setGrowthChunkBlock(chunk, 1, 20, 1, 'ICE')

    const targets = await Effect.runPromise(collectIceMeltTargets([chunk]))

    expect(targets).toEqual([])
  })

  it('caps melt targets per tick', async () => {
    const chunk = makeGrowthChunk()
    chunk.blockLight = new Uint8Array(LIGHT_BYTE_LENGTH)

    for (let i = 0; i < ICE_MELT_MAX_PER_TICK + 8; i++) {
      const localX = i % CHUNK_SIZE
      const localZ = Math.floor(i / CHUNK_SIZE)
      setGrowthChunkBlock(chunk, localX, 20, localZ, 'ICE')
      setLightAt(chunk.blockLight, localX, 20, localZ, ICE_MELT_BLOCK_LIGHT_THRESHOLD + 1)
    }

    const targets = await Effect.runPromise(collectIceMeltTargets([chunk]))

    expect(targets).toHaveLength(ICE_MELT_MAX_PER_TICK)
  })

  it('fails on incomplete block buffers', async () => {
    const chunk = makeGrowthChunk(
      { x: 0, z: 0 },
      new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT - 1),
    )

    await expect(Effect.runPromise(collectIceMeltTargets([chunk]))).rejects.toThrow(/complete chunk blocks buffers/)
  })

  it('fails on incomplete block light buffers', async () => {
    const chunk = makeGrowthChunk()
    chunk.blockLight = new Uint8Array(LIGHT_BYTE_LENGTH - 1)

    await expect(Effect.runPromise(collectIceMeltTargets([chunk]))).rejects.toThrow(/complete chunk blockLight buffers/)
  })
})
