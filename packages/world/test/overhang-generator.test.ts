import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import { CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import { collectOverhangTargets, applyOverhangNoise } from '../domain/terrain/generator-pipeline'
import { OVERHANG_BAND_HEIGHT, OVERHANG_THRESHOLD, OVERHANG_NOISE_SCALE } from '../domain/terrain/constants'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'
import type { ColumnState } from '../domain/terrain/generator-types'
import type { BiomeProperties } from '../domain/biome'
import { makeChunkBlockBuffer } from './chunk-buffer-test-utils'
import { makeChunkColumnArray } from './terrain-channel-test-utils'

const AIR = blockTypeToIndex('AIR')
const STONE = blockTypeToIndex('STONE')

const MINIMAL_PROPS: BiomeProperties = {
  surfaceBlock: 'GRASS',
  subSurfaceBlock: 'DIRT',
  treeDensity: 0,
  temperature: 0.5,
  humidity: 0.5,
}

const makeColumnStates = (
  overrides: Partial<Record<number, Partial<ColumnState>>> = {},
  defaults: Partial<ColumnState> = {},
): ReadonlyArray<ColumnState> =>
  makeChunkColumnArray((i) => ({
    biome: 'PLAINS',
    props: MINIMAL_PROPS,
    surfaceY: 64,
    lakeBasinY: Option.none(),
    ruggedness: 0.3,
    ...defaults,
    ...overrides[i],
  }))

const makeBlocks = (): Uint8Array<ArrayBufferLike> => makeChunkBlockBuffer()

describe('collectOverhangTargets', () => {
  it('returns empty arrays when no columns are eligible (low ruggedness, non-mountain biomes)', () => {
    const blocks = makeBlocks()
    const columnStates = makeColumnStates()
    const result = collectOverhangTargets(blocks, 0, 0, columnStates, AIR)
    expect(result.overhangTargets).toHaveLength(0)
    expect(result.overhangXs).toHaveLength(0)
    expect(result.overhangYs).toHaveLength(0)
    expect(result.overhangZs).toHaveLength(0)
  })

  it('collects y-range targets above surface for a MOUNTAINS column with air blocks', () => {
    const blocks = makeBlocks()
    // Column (0,0) at flat index 0: MOUNTAINS, surfaceY=64, all neighbors flat at 64.
    // neighborMaxSurface = 64; supportCeiling = max(64+2, 64+6) = 70.
    // Scan y from 66 to min(254, 64+14)=78, skip y > 70 → y = 66..70 (5 targets).
    const columnStates = makeColumnStates({ 0: { biome: 'MOUNTAINS', ruggedness: 0.8 } })
    const result = collectOverhangTargets(blocks, 0, 0, columnStates, AIR)
    const targets = result.overhangTargets.filter((t) => t.lx === 0 && t.lz === 0)
    expect(targets.map((t) => t.y).sort((a, b) => a - b)).toEqual([66, 67, 68, 69, 70])
  })

  it('collects targets for columns with ruggedness >= 0.58 regardless of biome', () => {
    const blocks = makeBlocks()
    // Column (2,3) at flat index 2 * CHUNK_SIZE + 3: PLAINS, ruggedness=0.60, surfaceY=70.
    // Neighbors also at surfaceY=70 → neighborMaxSurface=70; supportCeiling = 70+2=72.
    // Scan y from 72 to min(254, 70+14)=84, skip y > 72 → only y=72 (1 target).
    const ruggedColumnIndex = 2 * CHUNK_SIZE + 3
    const columnStates = makeColumnStates({ [ruggedColumnIndex]: { ruggedness: 0.60, surfaceY: 70 } }, { surfaceY: 70 })
    const result = collectOverhangTargets(blocks, 0, 0, columnStates, AIR)
    const targets = result.overhangTargets.filter((t) => t.lx === 2 && t.lz === 3)
    expect(targets).toHaveLength(1)
    expect(targets[0]?.y).toBe(72)
  })

  it('skips already-filled (non-air) blocks in the overhang scan range', () => {
    const blocks = makeBlocks()
    const columnStates = makeColumnStates({ 0: { biome: 'MOUNTAINS', ruggedness: 0.8 } })
    // Block (lx=0, y=68, lz=0) pre-filled with stone → skip it.
    blocks[chunkBlockIndexUnchecked(0, 68, 0)] = STONE
    const result = collectOverhangTargets(blocks, 0, 0, columnStates, AIR)
    const ys = result.overhangTargets
      .filter((t) => t.lx === 0 && t.lz === 0)
      .map((t) => t.y)
    expect(ys).not.toContain(68)
    expect(ys).toContain(66)
    expect(ys).toContain(70)
  })

  it('scales noise coordinates by OVERHANG_NOISE_SCALE with world-space offset', () => {
    const blocks = makeBlocks()
    const columnStates = makeColumnStates({ 0: { biome: 'MOUNTAINS', ruggedness: 0.8 } })
    const baseWorldX = 32
    const baseWorldZ = 16
    const result = collectOverhangTargets(blocks, baseWorldX, baseWorldZ, columnStates, AIR)
    const idx = result.overhangTargets.findIndex((t) => t.lx === 0 && t.lz === 0 && t.y === 66)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(result.overhangXs[idx]).toBeCloseTo((baseWorldX + 0) * OVERHANG_NOISE_SCALE)
    expect(result.overhangYs[idx]).toBeCloseTo(66 * OVERHANG_NOISE_SCALE)
    expect(result.overhangZs[idx]).toBeCloseTo((baseWorldZ + 0) * OVERHANG_NOISE_SCALE)
  })
})

describe('applyOverhangNoise', () => {
  const makeTarget = (lx: number, lz: number, y: number) => ({ lx, lz, y })

  it('fills an air block with stone when noise value exceeds threshold (and it is supported)', () => {
    const blocks = makeBlocks()
    const columnStates = makeColumnStates()
    const target = makeTarget(2, 3, 70)
    // A connectivity guard requires solid terrain below/beside the voxel; seed the block
    // directly below so this test isolates the threshold logic.
    blocks[chunkBlockIndexUnchecked(2, 69, 3)] = STONE
    // threshold at y=70 for PLAINS (surfaceY=64): heightFactor = 1-(70-64)/14 = 1-6/14 ≈ 0.571
    // threshold = 0.62 - 0.571*0.14 ≈ 0.62 - 0.08 = 0.54
    // Use noise = 0.99 (well above threshold)
    applyOverhangNoise(blocks, [target], [0.99], columnStates, STONE, AIR)
    expect(blocks[chunkBlockIndexUnchecked(2, 70, 3)]).toBe(STONE)
  })

  it('does NOT fill an isolated voxel with no solid support, even above threshold (anti-floating)', () => {
    const blocks = makeBlocks()
    const columnStates = makeColumnStates()
    // Target floats in all-air: no block below, no horizontal neighbor. Must stay air.
    const target = makeTarget(2, 3, 70)
    applyOverhangNoise(blocks, [target], [0.99], columnStates, STONE, AIR)
    expect(blocks[chunkBlockIndexUnchecked(2, 70, 3)]).toBe(AIR)
  })

  it('leaves an air block unchanged when noise value is at or below threshold', () => {
    const blocks = makeBlocks()
    const columnStates = makeColumnStates()
    const target = makeTarget(2, 3, 70)
    // Use noise = 0.0 (well below threshold)
    applyOverhangNoise(blocks, [target], [0.0], columnStates, STONE, AIR)
    expect(blocks[chunkBlockIndexUnchecked(2, 70, 3)]).toBe(AIR)
  })

  it('uses a lower threshold for MOUNTAINS biome (overhangs fill more easily)', () => {
    const blocks1 = makeBlocks()
    const blocks2 = makeBlocks()
    const target = makeTarget(0, 0, 68)
    const surfaceY = 64

    const plainsStates = makeColumnStates({ 0: { biome: 'PLAINS', surfaceY } })
    const mountainStates = makeColumnStates({ 0: { biome: 'MOUNTAINS', surfaceY } })
    // Seed support below the target so the connectivity guard passes and the threshold is isolated.
    blocks1[chunkBlockIndexUnchecked(0, 67, 0)] = STONE
    blocks2[chunkBlockIndexUnchecked(0, 67, 0)] = STONE

    // heightFactor = 1 - (68-64)/14 ≈ 0.714
    // PLAINS threshold = 0.62 - 0.714*0.14 ≈ 0.52
    // MOUNTAINS threshold = (0.62-0.08) - 0.714*0.14 ≈ 0.44
    // Noise = 0.50: fills MOUNTAINS (0.50 > 0.44) but NOT PLAINS (0.50 < 0.52)
    const noiseAtBoundary = 0.50
    applyOverhangNoise(blocks1, [target], [noiseAtBoundary], plainsStates, STONE, AIR)
    applyOverhangNoise(blocks2, [target], [noiseAtBoundary], mountainStates, STONE, AIR)

    expect(blocks1[chunkBlockIndexUnchecked(0, 68, 0)]).toBe(AIR)
    expect(blocks2[chunkBlockIndexUnchecked(0, 68, 0)]).toBe(STONE)
  })

  it('base threshold equals OVERHANG_THRESHOLD for non-mountains at max band height', () => {
    const blocks = makeBlocks()
    // At y = surfaceY + OVERHANG_BAND_HEIGHT: heightFactor = 0, threshold = OVERHANG_THRESHOLD exactly.
    // noise just above → fill; noise equal → no fill (not strictly greater).
    const surfaceY = 50
    const y = surfaceY + OVERHANG_BAND_HEIGHT
    const columnStates = makeColumnStates({ 0: { biome: 'PLAINS', surfaceY } })
    const target = makeTarget(0, 0, y)
    blocks[chunkBlockIndexUnchecked(0, y - 1, 0)] = STONE // support below (isolate threshold)
    applyOverhangNoise(blocks, [target], [OVERHANG_THRESHOLD + 0.001], columnStates, STONE, AIR)
    expect(blocks[chunkBlockIndexUnchecked(0, y, 0)]).toBe(STONE)

    const blocks2 = makeBlocks()
    blocks2[chunkBlockIndexUnchecked(0, y - 1, 0)] = STONE
    applyOverhangNoise(blocks2, [target], [OVERHANG_THRESHOLD], columnStates, STONE, AIR)
    expect(blocks2[chunkBlockIndexUnchecked(0, y, 0)]).toBe(AIR)
  })

  it('skips blocks that are already non-air (does not overwrite existing stone)', () => {
    const blocks = makeBlocks()
    const columnStates = makeColumnStates()
    const target = makeTarget(1, 1, 70)
    blocks[chunkBlockIndexUnchecked(1, 70, 1)] = STONE
    const before = blocks[chunkBlockIndexUnchecked(1, 70, 1)]
    applyOverhangNoise(blocks, [target], [0.99], columnStates, STONE, AIR)
    expect(blocks[chunkBlockIndexUnchecked(1, 70, 1)]).toBe(before)
  })
})
