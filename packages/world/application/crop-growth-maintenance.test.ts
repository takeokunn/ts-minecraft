import { Effect, MutableRef } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { LIGHT_BYTE_LENGTH, setLightAt } from '@ts-minecraft/block/domain/light'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { runCropGrowthMaintenance } from './crop-growth-maintenance'
import { makeGrowthChunk, setGrowthChunkBlock } from '../test/plant-growth-test-kit'

describe('crop growth maintenance', () => {
  it('only advances the accumulator below the crop interval', () => {
    const tickAll = vi.fn(() => Effect.void)
    const getLoadedChunks = vi.fn(() => Effect.succeed([makeGrowthChunk()]))
    const forceSetBlock = vi.fn(() => Effect.void)
    const cropTickAccumulatorRef = MutableRef.make(0.25)

    Effect.runSync(runCropGrowthMaintenance(
      {
        blockService: { forceSetBlock },
        chunkManagerService: { getLoadedChunks },
        cropGrowthService: { tickAll },
      },
      { cropTickAccumulatorRef },
      DeltaTimeSecs.make(0.5),
    ))

    expect(MutableRef.get(cropTickAccumulatorRef)).toBe(0.75)
    expect(tickAll).not.toHaveBeenCalled()
    expect(getLoadedChunks).not.toHaveBeenCalled()
    expect(forceSetBlock).not.toHaveBeenCalled()
  })

  it('ticks crops, spreads grass, grows simple plants, and melts bright ice when the crop interval is reached', () => {
    const blockLight = new Uint8Array(LIGHT_BYTE_LENGTH)
    const chunk = { ...makeGrowthChunk({ x: 2, z: -1 }), blockLight }
    setGrowthChunkBlock(chunk, 3, 10, 4, 'SAND')
    setGrowthChunkBlock(chunk, 4, 10, 4, 'WATER')
    setGrowthChunkBlock(chunk, 3, 11, 4, 'SUGAR_CANE')
    setGrowthChunkBlock(chunk, 3, 10, 5, 'GRASS')
    setGrowthChunkBlock(chunk, 4, 10, 5, 'DIRT')
    setGrowthChunkBlock(chunk, 5, 10, 5, 'ICE')
    setLightAt(blockLight, 5, 10, 5, 12)

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
      DeltaTimeSecs.make(0.5),
    ))

    expect(MutableRef.get(cropTickAccumulatorRef)).toBe(0.25)
    expect(tickAll).toHaveBeenCalledTimes(1)
    expect(getLoadedChunks).toHaveBeenCalledTimes(1)
    expect(forceSetBlock).toHaveBeenCalledTimes(3)
    expect(forceSetBlock).toHaveBeenNthCalledWith(1, { x: 36, y: 10, z: -11 }, 'GRASS')
    expect(forceSetBlock).toHaveBeenNthCalledWith(2, { x: 35, y: 12, z: -12 }, 'SUGAR_CANE')
    expect(forceSetBlock).toHaveBeenNthCalledWith(3, { x: 37, y: 10, z: -11 }, 'WATER')
  })

  it('accumulates snow on exposed blocks in snow biomes during precipitation', () => {
    const chunk = makeGrowthChunk({ x: 2, z: -1 })
    setGrowthChunkBlock(chunk, 6, 10, 6, 'STONE')

    const tickAll = vi.fn(() => Effect.void)
    const getLoadedChunks = vi.fn(() => Effect.succeed([chunk]))
    const forceSetBlock = vi.fn(() => Effect.void)
    const getBiome = vi.fn((_x: number, _z: number) => Effect.succeed('SNOW' as const))
    const getWeather = vi.fn(() => Effect.succeed('rain' as const))
    const cropTickAccumulatorRef = MutableRef.make(59.75)

    Effect.runSync(runCropGrowthMaintenance(
      {
        blockService: { forceSetBlock },
        chunkManagerService: { getLoadedChunks },
        cropGrowthService: { tickAll },
        biomeService: { getBiome },
        getWeather,
      },
      { cropTickAccumulatorRef },
      DeltaTimeSecs.make(0.5),
    ))

    expect(getWeather).toHaveBeenCalledTimes(1)
    expect(getBiome).toHaveBeenCalledWith(38, -10)
    expect(forceSetBlock).toHaveBeenCalledTimes(1)
    expect(forceSetBlock).toHaveBeenCalledWith({ x: 38, y: 11, z: -10 }, 'SNOW')
  })

  it('does not query biomes or place snow during clear weather', () => {
    const chunk = makeGrowthChunk({ x: 2, z: -1 })
    setGrowthChunkBlock(chunk, 6, 10, 6, 'STONE')

    const tickAll = vi.fn(() => Effect.void)
    const getLoadedChunks = vi.fn(() => Effect.succeed([chunk]))
    const forceSetBlock = vi.fn(() => Effect.void)
    const getBiome = vi.fn((_x: number, _z: number) => Effect.succeed('SNOW' as const))
    const getWeather = vi.fn(() => Effect.succeed('clear' as const))
    const cropTickAccumulatorRef = MutableRef.make(59.75)

    Effect.runSync(runCropGrowthMaintenance(
      {
        blockService: { forceSetBlock },
        chunkManagerService: { getLoadedChunks },
        cropGrowthService: { tickAll },
        biomeService: { getBiome },
        getWeather,
      },
      { cropTickAccumulatorRef },
      DeltaTimeSecs.make(0.5),
    ))

    expect(getWeather).toHaveBeenCalledTimes(1)
    expect(getBiome).not.toHaveBeenCalled()
    expect(forceSetBlock).not.toHaveBeenCalled()
  })
})
