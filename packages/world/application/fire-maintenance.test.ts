import { Effect, MutableRef } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { DeltaTimeSecs } from '@ts-minecraft/core'

import { FIRE_MAINTENANCE_INTERVAL_SECS } from '../domain/fire-lifecycle'
import { makeGrowthChunk, setGrowthChunkBlock } from '../test/plant-growth-test-kit'
import { runFireMaintenance } from './fire-maintenance'

describe('runFireMaintenance', () => {
  it('only advances the accumulator below the fire interval', () => {
    const getLoadedChunks = vi.fn(() => Effect.succeed([makeGrowthChunk()]))
    const forceSetBlock = vi.fn(() => Effect.void)
    const fireTickAccumulatorRef = MutableRef.make(1)

    Effect.runSync(runFireMaintenance(
      {
        blockService: { forceSetBlock },
        chunkManagerService: { getLoadedChunks },
      },
      { fireTickAccumulatorRef },
      DeltaTimeSecs.make(0.5),
    ))

    expect(MutableRef.get(fireTickAccumulatorRef)).toBe(1.5)
    expect(getLoadedChunks).not.toHaveBeenCalled()
    expect(forceSetBlock).not.toHaveBeenCalled()
  })

  it('applies fire lifecycle actions when the interval is reached', () => {
    const chunk = makeGrowthChunk({ x: 2, z: -1 })
    setGrowthChunkBlock(chunk, 4, 10, 4, 'FIRE')
    const getLoadedChunks = vi.fn(() => Effect.succeed([chunk]))
    const forceSetBlock = vi.fn(() => Effect.void)
    const fireTickAccumulatorRef = MutableRef.make(FIRE_MAINTENANCE_INTERVAL_SECS - 0.25)

    Effect.runSync(runFireMaintenance(
      {
        blockService: { forceSetBlock },
        chunkManagerService: { getLoadedChunks },
      },
      { fireTickAccumulatorRef },
      DeltaTimeSecs.make(0.5),
    ))

    expect(MutableRef.get(fireTickAccumulatorRef)).toBe(0.25)
    expect(getLoadedChunks).toHaveBeenCalledTimes(1)
    expect(forceSetBlock).toHaveBeenCalledTimes(1)
    expect(forceSetBlock).toHaveBeenCalledWith({ x: 36, y: 10, z: -12 }, 'AIR')
  })

  it('ignores chunk lookup and block write failures', () => {
    const getLoadedChunks = vi.fn(() => Effect.die(new Error('chunk unavailable')))
    const forceSetBlock = vi.fn(() => Effect.die(new Error('write unavailable')))
    const fireTickAccumulatorRef = MutableRef.make(FIRE_MAINTENANCE_INTERVAL_SECS)

    expect(() => Effect.runSync(runFireMaintenance(
      {
        blockService: { forceSetBlock },
        chunkManagerService: { getLoadedChunks },
      },
      { fireTickAccumulatorRef },
      DeltaTimeSecs.make(0.001),
    ))).not.toThrow()

    expect(getLoadedChunks).toHaveBeenCalledTimes(1)
    expect(forceSetBlock).not.toHaveBeenCalled()
  })
})
