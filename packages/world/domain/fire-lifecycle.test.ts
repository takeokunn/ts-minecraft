import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  collectFireMaintenanceActions,
  FIRE_EXTINGUISH_MAX_PER_TICK,
  FIRE_SPREAD_MAX_PER_TICK,
  FireLifecycleChunkError,
} from './fire-lifecycle'
import { makeGrowthChunk, setGrowthChunkBlock } from '../test/plant-growth-test-kit'

describe('collectFireMaintenanceActions', () => {
  it('spreads fire into air next to flammable blocks', () => {
    const chunk = makeGrowthChunk({ x: 2, z: -1 })
    setGrowthChunkBlock(chunk, 4, 10, 4, 'FIRE')
    setGrowthChunkBlock(chunk, 3, 10, 4, 'WOOD')
    setGrowthChunkBlock(chunk, 6, 10, 4, 'PLANKS')

    const actions = Effect.runSync(collectFireMaintenanceActions([chunk]))

    expect(actions).toContainEqual({ position: { x: 37, y: 10, z: -12 }, blockType: 'FIRE' })
  })

  it('extinguishes unsupported fire', () => {
    const chunk = makeGrowthChunk({ x: 2, z: -1 })
    setGrowthChunkBlock(chunk, 4, 10, 4, 'FIRE')

    const actions = Effect.runSync(collectFireMaintenanceActions([chunk]))

    expect(actions).toEqual([{ position: { x: 36, y: 10, z: -12 }, blockType: 'AIR' }])
  })

  it('keeps fire supported by netherrack', () => {
    const chunk = makeGrowthChunk()
    setGrowthChunkBlock(chunk, 4, 10, 4, 'FIRE')
    setGrowthChunkBlock(chunk, 4, 9, 4, 'NETHERRACK')

    const actions = Effect.runSync(collectFireMaintenanceActions([chunk]))

    expect(actions).toEqual([])
  })

  it('limits spread and extinguish work per tick', () => {
    const chunk = makeGrowthChunk()
    for (let localX = 1; localX <= FIRE_EXTINGUISH_MAX_PER_TICK + 2; localX++) {
      setGrowthChunkBlock(chunk, localX % 14, 20 + Math.floor(localX / 14), 1, 'FIRE')
    }

    for (let localZ = 1; localZ <= FIRE_SPREAD_MAX_PER_TICK + 2; localZ++) {
      const y = 60 + Math.floor(localZ / 14)
      const z = localZ % 14
      setGrowthChunkBlock(chunk, 4, y, z, 'FIRE')
      setGrowthChunkBlock(chunk, 3, y, z, 'WOOD')
      setGrowthChunkBlock(chunk, 6, y, z, 'PLANKS')
    }

    const actions = Effect.runSync(collectFireMaintenanceActions([chunk]))

    expect(actions.filter((action) => action.blockType === 'AIR')).toHaveLength(FIRE_EXTINGUISH_MAX_PER_TICK)
    expect(actions.filter((action) => action.blockType === 'FIRE')).toHaveLength(FIRE_SPREAD_MAX_PER_TICK)
  })

  it('fails when a chunk has an incomplete block buffer', () => {
    const chunk = makeGrowthChunk({ x: 1, z: 2 }, new Uint8Array(1))

    const error = Effect.runSync(Effect.flip(collectFireMaintenanceActions([chunk])))

    expect(error).toBeInstanceOf(FireLifecycleChunkError)
  })
})
