import { describe, expect, it } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import {
  collectPlantGrowthTargets,
  PLANT_GROWTH_MAX_PER_TICK,
} from '@ts-minecraft/world'
import { Effect } from 'effect'
import { makeGrowthChunk, setGrowthChunkBlock } from './plant-growth-test-kit'

describe('collectPlantGrowthTargets', () => {
  it('grows sugar cane above the top block when the base has adjacent water', async () => {
    const chunk = makeGrowthChunk()
    setGrowthChunkBlock(chunk, 4, 10, 4, 'SAND')
    setGrowthChunkBlock(chunk, 5, 10, 4, 'WATER')
    setGrowthChunkBlock(chunk, 4, 11, 4, 'SUGAR_CANE')

    const targets = await Effect.runPromise(collectPlantGrowthTargets([chunk]))

    expect(targets).toEqual([{ position: { x: 4, y: 12, z: 4 }, blockType: 'SUGAR_CANE' }])
  })

  it('grows sugar cane stacks to at most three blocks tall', async () => {
    const chunk = makeGrowthChunk()
    setGrowthChunkBlock(chunk, 4, 10, 4, 'SAND')
    setGrowthChunkBlock(chunk, 5, 10, 4, 'WATER')
    setGrowthChunkBlock(chunk, 4, 11, 4, 'SUGAR_CANE')
    setGrowthChunkBlock(chunk, 4, 12, 4, 'SUGAR_CANE')

    const targets = await Effect.runPromise(collectPlantGrowthTargets([chunk]))

    expect(targets).toEqual([{ position: { x: 4, y: 13, z: 4 }, blockType: 'SUGAR_CANE' }])
  })

  it('does not grow sugar cane without water adjacent to the base support block', async () => {
    const chunk = makeGrowthChunk()
    setGrowthChunkBlock(chunk, 4, 10, 4, 'SAND')
    setGrowthChunkBlock(chunk, 4, 11, 4, 'SUGAR_CANE')

    const targets = await Effect.runPromise(collectPlantGrowthTargets([chunk]))

    expect(targets).toEqual([])
  })

  it('grows cactus above the top block when the target has empty horizontal sides', async () => {
    const chunk = makeGrowthChunk()
    setGrowthChunkBlock(chunk, 7, 9, 7, 'SAND')
    setGrowthChunkBlock(chunk, 7, 10, 7, 'CACTUS')

    const targets = await Effect.runPromise(collectPlantGrowthTargets([chunk]))

    expect(targets).toEqual([{ position: { x: 7, y: 11, z: 7 }, blockType: 'CACTUS' }])
  })

  it('does not grow cactus into a target level with a horizontal neighbor', async () => {
    const chunk = makeGrowthChunk()
    setGrowthChunkBlock(chunk, 7, 9, 7, 'SAND')
    setGrowthChunkBlock(chunk, 7, 10, 7, 'CACTUS')
    setGrowthChunkBlock(chunk, 8, 11, 7, 'STONE')

    const targets = await Effect.runPromise(collectPlantGrowthTargets([chunk]))

    expect(targets).toEqual([])
  })

  it('does not grow cactus stacks that are already three blocks tall', async () => {
    const chunk = makeGrowthChunk()
    setGrowthChunkBlock(chunk, 7, 9, 7, 'SAND')
    setGrowthChunkBlock(chunk, 7, 10, 7, 'CACTUS')
    setGrowthChunkBlock(chunk, 7, 11, 7, 'CACTUS')
    setGrowthChunkBlock(chunk, 7, 12, 7, 'CACTUS')

    const targets = await Effect.runPromise(collectPlantGrowthTargets([chunk]))

    expect(targets).toEqual([])
  })

  it('caps plant growth targets per tick', async () => {
    const chunk = makeGrowthChunk()
    for (let z = 1; z < CHUNK_SIZE - 1; z += 2) {
      for (let x = 1; x < CHUNK_SIZE - 1; x += 2) {
        setGrowthChunkBlock(chunk, x, 9, z, 'SAND')
        setGrowthChunkBlock(chunk, x, 10, z, 'CACTUS')
      }
    }

    const targets = await Effect.runPromise(collectPlantGrowthTargets([chunk]))

    expect(targets).toHaveLength(PLANT_GROWTH_MAX_PER_TICK)
  })

  it('fails on incomplete chunk block buffers', async () => {
    const chunk = makeGrowthChunk({ x: 0, z: 0 }, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT - 1))

    await expect(Effect.runPromise(collectPlantGrowthTargets([chunk]))).rejects.toThrow(/complete chunk block buffers/)
  })
})
