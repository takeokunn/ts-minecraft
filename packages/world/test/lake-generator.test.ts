import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import { CHUNK_HEIGHT } from '@ts-minecraft/core'
import { computeLakeBasin, fillWaterForColumn, resolveSurfaceY, shouldFreezeWaterSurface } from '../domain/terrain/lake-generator'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'
import { makeChunkBlockBuffer } from './chunk-buffer-test-utils'

describe('lake-generator', () => {
  it('creates inland basins below lake level and fills water with nonzero depth', () => {
    const terrainLevels = { seaLevel: 40, lakeLevel: 52 }
    const initialSurfaceY = terrainLevels.lakeLevel + 1
    const lakeBasinY = computeLakeBasin('PLAINS', 0.71, initialSurfaceY, terrainLevels)

    expect(Option.isSome(lakeBasinY)).toBe(true)
    if (Option.isNone(lakeBasinY)) {
expect.fail('expected inland lake basin')
    }

    const surfaceY = resolveSurfaceY('PLAINS', initialSurfaceY, lakeBasinY)
    expect(surfaceY).toBeLessThan(terrainLevels.lakeLevel)

    const blocks = makeChunkBlockBuffer()
    fillWaterForColumn(blocks, 0, 0, 'PLAINS', surfaceY, lakeBasinY, 6, 88, false, terrainLevels)

    const filledYs = Array.from({ length: CHUNK_HEIGHT }, (_, y) => y)
      .filter((y) => blocks[chunkBlockIndexUnchecked(0, y, 0)] === 6)

    expect(filledYs.length).toBeGreaterThan(0)
    expect(filledYs[0]).toBe(surfaceY + 1)
    expect(filledYs[filledYs.length - 1]).toBe(terrainLevels.lakeLevel)
  })

  it('freezes water surfaces in snow and low-temperature columns', () => {
    expect(shouldFreezeWaterSurface('SNOW', 0.5)).toBe(true)
    expect(shouldFreezeWaterSurface('PLAINS', 0.05)).toBe(true)
    expect(shouldFreezeWaterSurface('PLAINS', 0.5)).toBe(false)
  })
})
