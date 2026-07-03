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
    const lakeBasinY = computeLakeBasin('PLAINS', 0.95, initialSurfaceY, terrainLevels)

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

describe('shore shapes (vanilla-like banks)', () => {
  it('lake surface blends continuously — no carve cliff at the region boundary', () => {
    // Just past the threshold (t≈0): essentially untouched terrain.
    const edge = Option.getOrNull(computeLakeBasin('PLAINS', 0.701, 70))
    expect(70 - (edge ?? 70)).toBeLessThanOrEqual(1)
    // Deep center (t≈1) reaches a bed well below the y=62 water line.
    const center = Option.getOrNull(computeLakeBasin('PLAINS', 0.999, 70))
    expect(center).not.toBeNull()
    expect(center!).toBeLessThan(62 - 10)
    // Monotonic slope: adjacent noise samples never step more than 3 blocks.
    let prev = 70
    for (let v = 0.701; v <= 0.999; v += 0.01) {
      const y = Option.getOrNull(computeLakeBasin('PLAINS', v, 70)) ?? 70
      expect(prev - y).toBeLessThanOrEqual(3)
      prev = y
    }
  })

  it('river beds always sit below the water line — no dry canyons through hills', () => {
    // High terrain (y=90): the old cap left the bed at y=80, above y=62 water.
    const highBed = resolveSurfaceY('RIVER', 90, Option.none())
    expect(highBed).toBeLessThan(62)
    // Low terrain keeps a sane bed too.
    const lowBed = resolveSurfaceY('RIVER', 64, Option.none())
    expect(lowBed).toBeLessThan(62)
    expect(lowBed).toBeGreaterThanOrEqual(62 - 10)
  })
})
