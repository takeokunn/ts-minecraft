import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import {
  columnStateIndex,
  terrainSampleIndex,
  readNumber,
  readBiomeColumn,
  readColumnState,
  readOverhangTarget,
  readTerrainChannelValues,
  isLakeShoreColumn,
} from '@ts-minecraft/world/domain/terrain/generator-pipeline-model'
import type { BiomeColumn, TerrainChannelValues } from '@ts-minecraft/world/domain/terrain/generator-pipeline-model'
import type { ColumnState, OverhangTarget } from '@ts-minecraft/world/domain/terrain/generator-types'
import { LAKE_THRESHOLD, LAKE_SHORE_WIDTH } from '@ts-minecraft/world/domain/terrain/constants'

// ─── helpers ─────────────────────────────────────────────────────────────────

const PLAINS_BIOME_COLUMN: BiomeColumn = {
  biome: 'PLAINS',
  props: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.1, temperature: 0.5, humidity: 0.5 },
}

const FOREST_BIOME_COLUMN: BiomeColumn = {
  biome: 'FOREST',
  props: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity: 0.6, temperature: 0.4, humidity: 0.7 },
}

const makePlainsColumnState = (surfaceY: number, lakeBasinY: Option.Option<number> = Option.none()): ColumnState => ({
  biome: 'PLAINS',
  props: PLAINS_BIOME_COLUMN.props,
  surfaceY,
  lakeBasinY,
  ruggedness: 0,
})

const makeOverhangTarget = (lx: number, lz: number, y: number): OverhangTarget => ({ lx, lz, y })

const makeChannelSamples = (values: number[]) => ({
  erosion: new Float64Array(values),
  jaggedness: new Float64Array(values.map((v) => v * 0.5)),
  continentalness: new Float64Array(values.map((v) => v * 2)),
  pv: new Float64Array(values.map((v) => v * 0.25)),
})

// LAKE_THRESHOLD = 0.70, LAKE_SHORE_WIDTH = 0.04 → shore threshold = 0.66
const LAKE_LEVEL = 62
const TERRAIN_LEVELS = { seaLevel: 48, lakeLevel: LAKE_LEVEL }

// ─── columnStateIndex ────────────────────────────────────────────────────────
describe('columnStateIndex', () => {
  it('maps (0, 0) to index 0', () => {
    expect(columnStateIndex(0, 0)).toBe(0)
  })

  it('increments by CHUNK_SIZE when lx increases by 1', () => {
    expect(columnStateIndex(1, 0)).toBe(CHUNK_SIZE)
    expect(columnStateIndex(2, 0)).toBe(2 * CHUNK_SIZE)
  })

  it('increments by 1 when lz increases by 1', () => {
    expect(columnStateIndex(0, 1)).toBe(1)
    expect(columnStateIndex(0, 3)).toBe(3)
  })

  it('combines lx and lz correctly', () => {
    expect(columnStateIndex(1, 1)).toBe(CHUNK_SIZE + 1)
    expect(columnStateIndex(3, 5)).toBe(3 * CHUNK_SIZE + 5)
  })

  it('maps the last column (15, 15) to CHUNK_SIZE * CHUNK_SIZE - 1', () => {
    expect(columnStateIndex(15, 15)).toBe(CHUNK_SIZE * CHUNK_SIZE - 1)
  })
})

// ─── terrainSampleIndex ───────────────────────────────────────────────────────
describe('terrainSampleIndex', () => {
  it('maps (0, 0) to index 0', () => {
    expect(terrainSampleIndex(0, 0)).toBe(0)
  })

  it('increments by 1 when lx increases by 1', () => {
    expect(terrainSampleIndex(1, 0)).toBe(1)
    expect(terrainSampleIndex(3, 0)).toBe(3)
  })

  it('increments by CHUNK_SIZE when lz increases by 1', () => {
    expect(terrainSampleIndex(0, 1)).toBe(CHUNK_SIZE)
    expect(terrainSampleIndex(0, 2)).toBe(2 * CHUNK_SIZE)
  })

  it('combines lx and lz correctly', () => {
    expect(terrainSampleIndex(1, 1)).toBe(CHUNK_SIZE + 1)
    expect(terrainSampleIndex(5, 3)).toBe(3 * CHUNK_SIZE + 5)
  })

  it('maps the last sample (15, 15) to CHUNK_SIZE * CHUNK_SIZE - 1', () => {
    expect(terrainSampleIndex(15, 15)).toBe(CHUNK_SIZE * CHUNK_SIZE - 1)
  })

  it('differs from columnStateIndex for non-zero lx or lz (different storage layouts)', () => {
    expect(terrainSampleIndex(1, 0)).not.toBe(columnStateIndex(1, 0))
    expect(terrainSampleIndex(0, 1)).not.toBe(columnStateIndex(0, 1))
  })
})

// ─── readNumber ───────────────────────────────────────────────────────────────
describe('readNumber', () => {
  it('reads the value at the given index from a plain array', () => {
    expect(readNumber([10, 20, 30], 0)).toBe(10)
    expect(readNumber([10, 20, 30], 2)).toBe(30)
  })

  it('reads from a Float64Array', () => {
    const arr = new Float64Array([1.5, 2.5, 3.5])
    expect(readNumber(arr, 1)).toBe(2.5)
  })

  it('reads negative numbers correctly', () => {
    expect(readNumber([-5, 0, 5], 0)).toBe(-5)
  })
})

// ─── readBiomeColumn ──────────────────────────────────────────────────────────
describe('readBiomeColumn', () => {
  const columns: BiomeColumn[] = [PLAINS_BIOME_COLUMN, FOREST_BIOME_COLUMN]

  it('reads the first element', () => {
    expect(readBiomeColumn(columns, 0)).toBe(PLAINS_BIOME_COLUMN)
  })

  it('reads the second element', () => {
    expect(readBiomeColumn(columns, 1)).toBe(FOREST_BIOME_COLUMN)
  })

  it('returns the same reference (no copy)', () => {
    const result = readBiomeColumn(columns, 0)
    expect(result).toBe(PLAINS_BIOME_COLUMN)
  })
})

// ─── readColumnState ──────────────────────────────────────────────────────────
describe('readColumnState', () => {
  const states: ColumnState[] = [makePlainsColumnState(64), makePlainsColumnState(70, Option.some(68))]

  it('reads the first element', () => {
    expect(readColumnState(states, 0).surfaceY).toBe(64)
  })

  it('reads the second element', () => {
    expect(readColumnState(states, 1).surfaceY).toBe(70)
    expect(Option.isSome(readColumnState(states, 1).lakeBasinY)).toBe(true)
  })

  it('returns the same reference (no copy)', () => {
    const result = readColumnState(states, 0)
    expect(result).toBe(states[0])
  })
})

// ─── readOverhangTarget ───────────────────────────────────────────────────────
describe('readOverhangTarget', () => {
  const targets: OverhangTarget[] = [makeOverhangTarget(0, 0, 72), makeOverhangTarget(8, 4, 80)]

  it('reads the first element', () => {
    const t = readOverhangTarget(targets, 0)
    expect(t.lx).toBe(0)
    expect(t.y).toBe(72)
  })

  it('reads the second element', () => {
    const t = readOverhangTarget(targets, 1)
    expect(t.lx).toBe(8)
    expect(t.lz).toBe(4)
    expect(t.y).toBe(80)
  })

  it('returns the same reference (no copy)', () => {
    expect(readOverhangTarget(targets, 1)).toBe(targets[1])
  })
})

// ─── readTerrainChannelValues ─────────────────────────────────────────────────
describe('readTerrainChannelValues', () => {
  const samples = makeChannelSamples([0.5, 0.8, 0.3])

  it('reads erosion from the correct channel at the given index', () => {
    const result: TerrainChannelValues = readTerrainChannelValues(samples, 0)
    expect(result.erosion).toBe(0.5)
  })

  it('reads jaggedness (half of base) at index 1', () => {
    const result = readTerrainChannelValues(samples, 1)
    expect(result.jaggedness).toBeCloseTo(0.4)
  })

  it('reads continentalness (double of base) at index 2', () => {
    const result = readTerrainChannelValues(samples, 2)
    expect(result.continentalness).toBeCloseTo(0.6)
  })

  it('reads all four channels from the same index', () => {
    const result = readTerrainChannelValues(samples, 0)
    expect(result).toHaveProperty('erosion')
    expect(result).toHaveProperty('jaggedness')
    expect(result).toHaveProperty('continentalness')
    expect(result).toHaveProperty('pv')
  })

  it('returns independent values for different indices', () => {
    const a = readTerrainChannelValues(samples, 0)
    const b = readTerrainChannelValues(samples, 1)
    expect(a.erosion).not.toBe(b.erosion)
  })
})

// ─── isLakeShoreColumn ────────────────────────────────────────────────────────
describe('isLakeShoreColumn', () => {
  // true when: no lake basin, lakeNoiseVal > 0.66, surfaceY < 66
  const noBasin = Option.none<number>()
  const withBasin = Option.some(60)

  it('returns true when all three conditions are met', () => {
    expect(isLakeShoreColumn(noBasin, 0.68, 64, TERRAIN_LEVELS)).toBe(true)
  })

  it('returns false when a lake basin is present (lakeBasinY is Some)', () => {
    expect(isLakeShoreColumn(withBasin, 0.68, 64, TERRAIN_LEVELS)).toBe(false)
  })

  it('returns false when lakeNoiseVal equals the computed shore threshold exactly', () => {
    // 0.70 - 0.04 = 0.6599999999999999 in IEEE 754; the condition is strictly greater-than
    const shoreThreshold = LAKE_THRESHOLD - LAKE_SHORE_WIDTH
    expect(isLakeShoreColumn(noBasin, shoreThreshold, 64, TERRAIN_LEVELS)).toBe(false)
  })

  it('returns false when lakeNoiseVal is below the shore threshold', () => {
    expect(isLakeShoreColumn(noBasin, 0.5, 64, TERRAIN_LEVELS)).toBe(false)
  })

  it('returns false when surfaceY is at the lakeLevel + 4 boundary (not strictly below)', () => {
    expect(isLakeShoreColumn(noBasin, 0.68, LAKE_LEVEL + 4, TERRAIN_LEVELS)).toBe(false)
  })

  it('returns false when surfaceY exceeds lakeLevel + 4', () => {
    expect(isLakeShoreColumn(noBasin, 0.68, 100, TERRAIN_LEVELS)).toBe(false)
  })

  it('returns true just inside each boundary: noise barely above 0.66, surfaceY barely below 66', () => {
    expect(isLakeShoreColumn(noBasin, 0.661, LAKE_LEVEL + 3, TERRAIN_LEVELS)).toBe(true)
  })
})
