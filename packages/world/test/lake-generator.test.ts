import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, LAKE_LEVEL } from '@ts-minecraft/core'
import { computeLakeBasin, fillWaterForColumn, resolveSurfaceY } from '../domain/terrain/lake-generator'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'

describe('lake-generator', () => {
  it('creates inland basins below lake level and fills water with nonzero depth', () => {
    const initialSurfaceY = LAKE_LEVEL + 1
    const lakeBasinY = computeLakeBasin('PLAINS', 1.0, initialSurfaceY)

    expect(Option.isSome(lakeBasinY)).toBe(true)
    if (Option.isNone(lakeBasinY)) {
expect.fail('expected inland lake basin')
    }

    const surfaceY = resolveSurfaceY('PLAINS', initialSurfaceY, lakeBasinY)
    expect(surfaceY).toBeLessThan(LAKE_LEVEL)

    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
    fillWaterForColumn(blocks, 0, 0, 'PLAINS', surfaceY, lakeBasinY, 6)

    const filledYs = Array.from({ length: CHUNK_HEIGHT }, (_, y) => y)
      .filter((y) => blocks[chunkBlockIndexUnchecked(0, y, 0)] === 6)

    expect(filledYs.length).toBeGreaterThan(0)
    expect(filledYs[0]).toBe(surfaceY + 1)
    expect(filledYs[filledYs.length - 1]).toBe(LAKE_LEVEL)
  })
})
