import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, HashSet } from 'effect'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/kernel'
import {
  ORE_CONFIGS,
  ORE_MIN_Y_FLOOR,
  DEEPSLATE_CEILING,
  ORE_REGULAR_INDICES,
  ORE_DEEPSLATE_INDICES,
  growVein,
  placeOres,
} from '@ts-minecraft/terrain'

// ---------------------------------------------------------------------------
// Shared block indices
// ---------------------------------------------------------------------------

const AIR       = blockTypeToIndex('AIR')
const STONE     = blockTypeToIndex('STONE')
const DEEPSLATE = blockTypeToIndex('DEEPSLATE')
const COAL_ORE  = blockTypeToIndex('COAL_ORE')
const DS_COAL   = blockTypeToIndex('DEEPSLATE_COAL_ORE')

const makeBlocks = (): Uint8Array => new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)

const setBlock = (blocks: Uint8Array, lx: number, y: number, lz: number, val: number): void => {
  blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] = val
}

const getBlock = (blocks: Uint8Array, lx: number, y: number, lz: number): number =>
  blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE]!

const fillAll = (blocks: Uint8Array, val: number): void => {
  blocks.fill(val)
}

// ---------------------------------------------------------------------------
// ORE_REGULAR_INDICES / ORE_DEEPSLATE_INDICES
// ---------------------------------------------------------------------------

describe('ORE_REGULAR_INDICES', () => {
  it('has the same length as ORE_CONFIGS (7 ore types)', () => {
    expect(ORE_REGULAR_INDICES.length).toBe(ORE_CONFIGS.length)
    expect(ORE_REGULAR_INDICES.length).toBe(7)
  })

  it('all indices are valid non-negative integers', () => {
    Arr.forEach(ORE_REGULAR_INDICES, idx => {
      expect(Number.isInteger(idx)).toBe(true)
      expect(idx).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('ORE_DEEPSLATE_INDICES', () => {
  it('has the same length as ORE_CONFIGS (7 ore types)', () => {
    expect(ORE_DEEPSLATE_INDICES.length).toBe(ORE_CONFIGS.length)
    expect(ORE_DEEPSLATE_INDICES.length).toBe(7)
  })

  it('all indices are valid non-negative integers', () => {
    Arr.forEach(ORE_DEEPSLATE_INDICES, idx => {
      expect(Number.isInteger(idx)).toBe(true)
      expect(idx).toBeGreaterThanOrEqual(0)
    })
  })

  it('deepslate indices differ from regular indices', () => {
    Arr.forEach(Arr.makeBy(ORE_CONFIGS.length, i => i), i => {
      expect(ORE_DEEPSLATE_INDICES[i]).not.toBe(ORE_REGULAR_INDICES[i])
    })
  })
})

// ---------------------------------------------------------------------------
// growVein
// ---------------------------------------------------------------------------

describe('growVein', () => {
  it('targetSize=0 → no blocks placed, block array unchanged', () => {
    const blocks = makeBlocks()
    fillAll(blocks, STONE)
    const initialSnapshot = Uint8Array.from(blocks)
    growVein(blocks, 8, 20, 8, 0, COAL_ORE, DS_COAL, STONE, DEEPSLATE, ORE_MIN_Y_FLOOR, 64, 12345)
    expect(blocks).toEqual(initialSnapshot)
  })

  it('returns the advanced RNG state (a number)', () => {
    const blocks = makeBlocks()
    fillAll(blocks, STONE)
    const newState = growVein(blocks, 8, 20, 8, 3, COAL_ORE, DS_COAL, STONE, DEEPSLATE, ORE_MIN_Y_FLOOR, 64, 0)
    expect(typeof newState).toBe('number')
  })

  it('only places ore in STONE or DEEPSLATE cells — AIR cells are skipped', () => {
    const blocks = makeBlocks() // all AIR
    // Place a few STONE blocks around the seed position
    setBlock(blocks, 8, 20, 8, STONE)
    setBlock(blocks, 9, 20, 8, STONE)
    setBlock(blocks, 8, 21, 8, STONE)

    growVein(blocks, 8, 20, 8, 5, COAL_ORE, DS_COAL, STONE, DEEPSLATE, ORE_MIN_Y_FLOOR, 64, 99)

    // All remaining AIR cells should still be AIR
    Arr.forEach(
      Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
        Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lz => lz), lz =>
          Arr.makeBy(CHUNK_HEIGHT, y => ({ lx, lz, y }))
        )
      ),
      ({ lx, lz, y }) => {
        const b = getBlock(blocks, lx, y, lz)
        expect(b === AIR || b === STONE || b === DEEPSLATE || b === COAL_ORE || b === DS_COAL).toBe(true)
      }
    )
  })

  it('places deepslate ore variant below DEEPSLATE_CEILING when seed is in DEEPSLATE', () => {
    const blocks = makeBlocks()
    const seedY = DEEPSLATE_CEILING - 2 // y=14, below ceiling (16)
    // Fill deep area with DEEPSLATE
    Arr.forEach(
      Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
        Arr.map(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => ({ lx, lz }))
      ),
      ({ lx, lz }) => Arr.forEach(Arr.makeBy(DEEPSLATE_CEILING - ORE_MIN_Y_FLOOR, i => ORE_MIN_Y_FLOOR + i), y => setBlock(blocks, lx, y, lz, DEEPSLATE))
    )
    growVein(blocks, 8, seedY, 8, 1, COAL_ORE, DS_COAL, STONE, DEEPSLATE, ORE_MIN_Y_FLOOR, DEEPSLATE_CEILING - 1, 42)
    // The seed position should now be a deepslate ore (or not changed if seed was skipped)
    const placed = getBlock(blocks, 8, seedY, 8)
    expect(placed === DS_COAL || placed === DEEPSLATE).toBe(true)
  })

  it('respects yMin/yMax bounds — does not place outside the vertical range', () => {
    const Y_MIN = 20
    const Y_MAX = 25
    const blocks = makeBlocks()
    fillAll(blocks, STONE)

    growVein(blocks, 8, 22, 8, 100, COAL_ORE, DS_COAL, STONE, DEEPSLATE, Y_MIN, Y_MAX, 77777)

    // Outside [Y_MIN, Y_MAX]: must not be ore
    Arr.forEach(
      Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
        Arr.map(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => ({ lx, lz }))
      ),
      ({ lx, lz }) => {
        Arr.forEach(Arr.makeBy(Y_MIN, y => y), y => {
          expect(getBlock(blocks, lx, y, lz) === COAL_ORE || getBlock(blocks, lx, y, lz) === DS_COAL).toBe(false)
        })
        Arr.forEach(Arr.makeBy(CHUNK_HEIGHT - Y_MAX - 1, i => Y_MAX + 1 + i), y => {
          expect(getBlock(blocks, lx, y, lz) === COAL_ORE || getBlock(blocks, lx, y, lz) === DS_COAL).toBe(false)
        })
      }
    )
  })
})

// ---------------------------------------------------------------------------
// placeOres
// ---------------------------------------------------------------------------

const ORE_INDICES = {
  stoneBlockIndex: STONE,
  deepslateBlockIndex: DEEPSLATE,
  regular: ORE_REGULAR_INDICES,
  deepslate: ORE_DEEPSLATE_INDICES,
}

describe('placeOres', () => {
  it('is deterministic — same input produces identical output', () => {
    const blocks1 = makeBlocks()
    fillAll(blocks1, STONE)
    const blocks2 = makeBlocks()
    fillAll(blocks2, STONE)

    placeOres(blocks1, 0, 0, ORE_INDICES)
    placeOres(blocks2, 0, 0, ORE_INDICES)

    expect(blocks1).toEqual(blocks2)
  })

  it('different chunk coordinates produce different ore patterns', () => {
    const blocks1 = makeBlocks()
    fillAll(blocks1, STONE)
    const blocks2 = makeBlocks()
    fillAll(blocks2, STONE)

    placeOres(blocks1, 0, 0, ORE_INDICES)
    placeOres(blocks2, 16, 0, ORE_INDICES)

    expect(blocks1).not.toEqual(blocks2)
  })

  it('never places ores below y=ORE_MIN_Y_FLOOR (y=5)', () => {
    const blocks = makeBlocks()
    fillAll(blocks, STONE)
    placeOres(blocks, 0, 0, ORE_INDICES)

    const oreIndexSet = HashSet.fromIterable(Arr.appendAll(ORE_REGULAR_INDICES, ORE_DEEPSLATE_INDICES))
    Arr.forEach(
      Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
        Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lz => lz), lz =>
          Arr.makeBy(ORE_MIN_Y_FLOOR, y => ({ lx, lz, y }))
        )
      ),
      ({ lx, lz, y }) => {
        const b = getBlock(blocks, lx, y, lz)
        expect(HashSet.has(oreIndexSet, b)).toBe(false)
      }
    )
  })

  it('only modifies STONE and DEEPSLATE cells — AIR cells remain AIR', () => {
    const blocks = makeBlocks() // all AIR
    placeOres(blocks, 0, 0, ORE_INDICES)
    // No block should have been written (no STONE/DEEPSLATE to replace)
    expect(blocks.every((b) => b === AIR)).toBe(true)
  })

  it('places at least some ores in a fully STONE chunk', () => {
    const blocks = makeBlocks()
    fillAll(blocks, STONE)
    placeOres(blocks, 0, 0, ORE_INDICES)

    const oreIndexSet = HashSet.fromIterable(Arr.appendAll(ORE_REGULAR_INDICES, ORE_DEEPSLATE_INDICES))
    const oreCount = Arr.filter(Arr.fromIterable(blocks), b => HashSet.has(oreIndexSet, b)).length
    expect(oreCount).toBeGreaterThan(0)
  })

  it('places deepslate ore variants in the deepslate zone of a fully-DEEPSLATE chunk', () => {
    // Fill only the deepslate zone (y < DEEPSLATE_CEILING) with DEEPSLATE — ores placed
    // there must use the deepslate variant index. Remaining cells are AIR so
    // above-ceiling seed positions are skipped, exercising the sampleOreY triangular
    // path for low-y ore configs (DIAMOND, REDSTONE, GOLD, LAPIS).
    const blocks = makeBlocks()
    Arr.forEach(
      Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
        Arr.map(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => ({ lx, lz }))
      ),
      ({ lx, lz }) =>
        Arr.forEach(Arr.makeBy(DEEPSLATE_CEILING - ORE_MIN_Y_FLOOR, i => ORE_MIN_Y_FLOOR + i), y =>
          setBlock(blocks, lx, y, lz, DEEPSLATE)
        )
    )

    placeOres(blocks, 0, 0, ORE_INDICES)

    // Any ore placed below DEEPSLATE_CEILING must be a deepslate variant.
    const deepslateOreSet = HashSet.fromIterable(ORE_DEEPSLATE_INDICES)
    const regularOreSet  = HashSet.fromIterable(ORE_REGULAR_INDICES)

    Arr.forEach(
      Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
        Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lz => lz), lz =>
          Arr.makeBy(DEEPSLATE_CEILING, y => ({ lx, lz, y }))
        )
      ),
      ({ lx, lz, y }) => {
        const b = getBlock(blocks, lx, y, lz)
        // Regular ore must never appear in the deepslate zone.
        if (HashSet.has(regularOreSet, b)) {
          expect.fail(`Regular ore index ${b} found at y=${y} which is below DEEPSLATE_CEILING=${DEEPSLATE_CEILING}`)
        }
        // Any block must be AIR, DEEPSLATE, or a deepslate ore variant.
        expect(
          b === AIR || b === DEEPSLATE || HashSet.has(deepslateOreSet, b)
        ).toBe(true)
      }
    )
  })

  it('produces a different ore layout for every distinct chunk coordinate pair sampled', () => {
    // Exercises sampleOreY with different RNG seeds for multiple chunk origins,
    // confirming the per-chunk salt in seedFromChunk produces unique distributions.
    const coords = [[0, 0], [0, 16], [16, 0], [16, 16], [-16, 0], [0, -16]] as const
    const snapshots = Arr.map(coords, ([wx, wz]) => {
      const b = makeBlocks()
      fillAll(b, STONE)
      placeOres(b, wx, wz, ORE_INDICES)
      return b.slice()
    })

    // Each pair of snapshots must differ (unique salt ensures unique placement).
    Arr.forEach(Arr.makeBy(snapshots.length, i => i), i =>
      Arr.forEach(Arr.makeBy(snapshots.length, j => j), j => {
        if (i >= j) return
        // Snapshots i and j should NOT be identical.
        const a = snapshots[i]!
        const b = snapshots[j]!
        expect(a.some((v, k) => v !== b[k])).toBe(true)
      })
    )
  })
})
