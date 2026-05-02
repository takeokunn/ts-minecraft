import { describe, it, expect } from 'vitest'
import { Array as Arr, Schema } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/domain'
import {
  createTerrainNoiseCoordinates,
  TerrainGenerationInputSchema,
} from '@ts-minecraft/terrain-generator'

// ---------------------------------------------------------------------------
// createTerrainNoiseCoordinates
// ---------------------------------------------------------------------------

describe('application/terrain/terrain-generation — createTerrainNoiseCoordinates', () => {
  it('returns exactly CHUNK_SIZE * CHUNK_SIZE (256) coordinate pairs', () => {
    const coords = createTerrainNoiseCoordinates({ x: 0, z: 0 })
    expect(coords.length).toBe(CHUNK_SIZE * CHUNK_SIZE)
  })

  it('origin chunk: wx starts at 0 and wz starts at 0', () => {
    const coords = createTerrainNoiseCoordinates({ x: 0, z: 0 })
    const first = Arr.get(coords, 0)
    expect(first._tag).toBe('Some')
    if (first._tag === 'Some') {
      expect(first.value.wx).toBe(0)
      expect(first.value.wz).toBe(0)
    }
  })

  it('chunk at (1, 0): wx starts at CHUNK_SIZE, wz starts at 0', () => {
    const coords = createTerrainNoiseCoordinates({ x: 1, z: 0 })
    const first = Arr.get(coords, 0)
    expect(first._tag).toBe('Some')
    if (first._tag === 'Some') {
      expect(first.value.wx).toBe(CHUNK_SIZE)
      expect(first.value.wz).toBe(0)
    }
  })

  it('chunk at (0, 1): wx starts at 0, wz starts at CHUNK_SIZE', () => {
    const coords = createTerrainNoiseCoordinates({ x: 0, z: 1 })
    const first = Arr.get(coords, 0)
    expect(first._tag).toBe('Some')
    if (first._tag === 'Some') {
      expect(first.value.wx).toBe(0)
      expect(first.value.wz).toBe(CHUNK_SIZE)
    }
  })

  it('all wx values are in [baseX, baseX + CHUNK_SIZE - 1]', () => {
    const cx = 3
    const baseX = cx * CHUNK_SIZE
    const coords = createTerrainNoiseCoordinates({ x: cx, z: 0 })
    Arr.forEach(coords, ({ wx }) => {
      expect(wx).toBeGreaterThanOrEqual(baseX)
      expect(wx).toBeLessThan(baseX + CHUNK_SIZE)
    })
  })

  it('all wz values are in [baseZ, baseZ + CHUNK_SIZE - 1]', () => {
    const cz = 5
    const baseZ = cz * CHUNK_SIZE
    const coords = createTerrainNoiseCoordinates({ x: 0, z: cz })
    Arr.forEach(coords, ({ wz }) => {
      expect(wz).toBeGreaterThanOrEqual(baseZ)
      expect(wz).toBeLessThan(baseZ + CHUNK_SIZE)
    })
  })

  it('all CHUNK_SIZE wx offsets are represented in the result', () => {
    const coords = createTerrainNoiseCoordinates({ x: 0, z: 0 })
    const wxValues = Arr.map(coords, ({ wx }) => wx)
    // Each lx in [0..CHUNK_SIZE-1] must appear exactly CHUNK_SIZE times
    Arr.forEach(Arr.makeBy(CHUNK_SIZE, i => i), (lx) => {
      const count = wxValues.filter(wx => wx === lx).length
      expect(count).toBe(CHUNK_SIZE)
    })
  })

  it('is deterministic — same coord produces the same array', () => {
    const a = createTerrainNoiseCoordinates({ x: 2, z: -3 })
    const b = createTerrainNoiseCoordinates({ x: 2, z: -3 })
    expect(a).toEqual(b)
  })

  it('negative chunk coords produce negative world coords', () => {
    const coords = createTerrainNoiseCoordinates({ x: -1, z: -1 })
    Arr.forEach(coords, ({ wx, wz }) => {
      expect(wx).toBeLessThan(0)
      expect(wz).toBeLessThan(0)
    })
  })
})

// ---------------------------------------------------------------------------
// TerrainGenerationInputSchema — validation
// ---------------------------------------------------------------------------

describe('application/terrain/terrain-generation — TerrainGenerationInputSchema', () => {
  it('accepts valid input with origin chunk', () => {
    const input = Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
      coord: { x: 0, z: 0 },
      seaLevel: 48,
      lakeLevel: 62,
      seed: 12345,
    })
    expect(input.coord).toEqual({ x: 0, z: 0 })
    expect(input.seaLevel).toBe(48)
    expect(input.lakeLevel).toBe(62)
    expect(input.seed).toBe(12345)
  })

  it('accepts seaLevel at boundary 0', () => {
    const input = Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
      coord: { x: 0, z: 0 },
      seaLevel: 0,
      lakeLevel: 0,
      seed: 1,
    })
    expect(input.seaLevel).toBe(0)
  })

  it('accepts seaLevel at boundary CHUNK_HEIGHT - 1 (255)', () => {
    const input = Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
      coord: { x: 0, z: 0 },
      seaLevel: CHUNK_HEIGHT - 1,
      lakeLevel: 0,
      seed: 1,
    })
    expect(input.seaLevel).toBe(CHUNK_HEIGHT - 1)
  })

  it('rejects seaLevel below 0', () => {
    expect(() =>
      Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
        coord: { x: 0, z: 0 },
        seaLevel: -1,
        lakeLevel: 48,
        seed: 1,
      })
    ).toThrow()
  })

  it('rejects seaLevel above CHUNK_HEIGHT - 1 (256)', () => {
    expect(() =>
      Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
        coord: { x: 0, z: 0 },
        seaLevel: CHUNK_HEIGHT,
        lakeLevel: 48,
        seed: 1,
      })
    ).toThrow()
  })

  it('rejects fractional seaLevel (not integer)', () => {
    expect(() =>
      Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
        coord: { x: 0, z: 0 },
        seaLevel: 48.5,
        lakeLevel: 62,
        seed: 1,
      })
    ).toThrow()
  })

  it('rejects fractional seed (not integer)', () => {
    expect(() =>
      Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
        coord: { x: 0, z: 0 },
        seaLevel: 48,
        lakeLevel: 62,
        seed: 1.5,
      })
    ).toThrow()
  })

  it('accepts negative seed values (seeds are integers, no lower bound)', () => {
    const input = Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
      coord: { x: 0, z: 0 },
      seaLevel: 48,
      lakeLevel: 62,
      seed: -99999,
    })
    expect(input.seed).toBe(-99999)
  })
})
