import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Option } from 'effect'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { SEA_LEVEL } from '@ts-minecraft/core'
import {
  shouldPlaceTree,
  selectTreeArchetype,
  placeTree,
  WOOD_BLOCK_INDEX,
} from '@ts-minecraft/world'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const makeBlocks = (): Uint8Array => new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)

const getBlock = (blocks: Uint8Array, lx: number, y: number, lz: number): number =>
  blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE]!

// ---------------------------------------------------------------------------
// shouldPlaceTree
// ---------------------------------------------------------------------------

describe('shouldPlaceTree', () => {
  const SURFACE_Y = 70 // above 5, below CHUNK_HEIGHT - 15

  it('returns { place: false } when treeDensity=0', () => {
    const result = shouldPlaceTree(0, SURFACE_Y, 100, 200)
    expect(result.place).toBe(false)
  })

  it('allows tree origins near chunk edges so neighboring chunks can contribute seamless canopies', () => {
    const edgeOrigin = shouldPlaceTree(1.0, SURFACE_Y, 15, 8)
    expect(edgeOrigin.place).toBe(true)
  })

  it('returns { place: false } when surfaceY <= 5', () => {
    const result = shouldPlaceTree(1.0, 5, 100, 200)
    expect(result.place).toBe(false)
  })

  it('returns { place: false } when surfaceY >= CHUNK_HEIGHT - 15', () => {
    const result = shouldPlaceTree(1.0, CHUNK_HEIGHT - 15, 100, 200)
    expect(result.place).toBe(false)
  })

  it('is deterministic — same inputs produce the same result', () => {
    const r1 = shouldPlaceTree(0.5, SURFACE_Y, 32, 64)
    const r2 = shouldPlaceTree(0.5, SURFACE_Y, 32, 64)
    expect(r1.place).toBe(r2.place)
    expect(r1.treeRng).toBe(r2.treeRng)
  })

  it('different wx/wz produce different treeRng values', () => {
    const r1 = shouldPlaceTree(1.0, SURFACE_Y, 0, 0)
    const r2 = shouldPlaceTree(1.0, SURFACE_Y, 1, 0)
    // treeRng uses wx/wz in a sine hash — different coords → different hash
    expect(r1.treeRng).not.toBe(r2.treeRng)
  })
})

// ---------------------------------------------------------------------------
// selectTreeArchetype
// ---------------------------------------------------------------------------

describe('selectTreeArchetype', () => {
  const LOW_SURFACE  = SEA_LEVEL     // non-highland
  const HIGH_SURFACE = SEA_LEVEL + 20 // highland (>= SEA_LEVEL + 18)

  it('always returns TALL_CANOPY for JUNGLE biome', () => {
    Arr.forEach([0, 0.1, 0.5, 0.99] as const, rng => {
      expect(selectTreeArchetype('JUNGLE', LOW_SURFACE, rng)).toBe('TALL_CANOPY')
      expect(selectTreeArchetype('JUNGLE', HIGH_SURFACE, rng)).toBe('TALL_CANOPY')
    })
  })

  it('always returns SPRUCE for SNOW biome', () => {
    Arr.forEach([0, 0.1, 0.5, 0.99] as const, rng => {
      expect(selectTreeArchetype('SNOW', LOW_SURFACE, rng)).toBe('SPRUCE')
      expect(selectTreeArchetype('SNOW', HIGH_SURFACE, rng)).toBe('SPRUCE')
    })
  })

  it('always returns SPRUCE for MOUNTAINS biome', () => {
    Arr.forEach([0, 0.1, 0.5, 0.99] as const, rng => {
      expect(selectTreeArchetype('MOUNTAINS', LOW_SURFACE, rng)).toBe('SPRUCE')
      expect(selectTreeArchetype('MOUNTAINS', HIGH_SURFACE, rng)).toBe('SPRUCE')
    })
  })

  it('PLAINS → ROUND_OAK (vanilla plains grow oak, not birch)', () => {
    // Oak regardless of roll — birch belongs to forests.
    expect(selectTreeArchetype('PLAINS', LOW_SURFACE, 0)).toBe('ROUND_OAK')
  })

  it('PLAINS with rng producing roll >= 0.28 → ROUND_OAK', () => {
    // Need a treeRng value where fract(rng * 1.324...) >= 0.28
    // rng = 0.5 → roll = fract(0.5 * 1.32471...) ≈ fract(0.66235) ≈ 0.66235 ≥ 0.28
    expect(selectTreeArchetype('PLAINS', LOW_SURFACE, 0.5)).toBe('ROUND_OAK')
  })

  it('FOREST highland with high roll → SPRUCE', () => {
    // For highland FOREST: if roll > 0.72 → SPRUCE
    // Need a rng where fract(rng * 1.32471) > 0.72
    // rng=0.55 → fract(0.55 * 1.32471) ≈ fract(0.72859) ≈ 0.72859 > 0.72
    expect(selectTreeArchetype('FOREST', HIGH_SURFACE, 0.55)).toBe('SPRUCE')
  })

  it('SWAMP → ROUND_OAK (vanilla swamp grows oak, not birch)', () => {
    expect(selectTreeArchetype('SWAMP', LOW_SURFACE, 0)).toBe('ROUND_OAK')
  })

  it('always returns SPRUCE for TAIGA biome (same case as SNOW/MOUNTAINS)', () => {
    Arr.forEach([0, 0.5, 0.99] as const, rng => {
      expect(selectTreeArchetype('TAIGA', LOW_SURFACE, rng)).toBe('SPRUCE')
    })
  })

  it('SAVANNA with roll < 0.7 → ACACIA (vanilla savanna grows acacia, not birch)', () => {
    // rng=0 → roll=0 < 0.7
    expect(selectTreeArchetype('SAVANNA', LOW_SURFACE, 0)).toBe('ACACIA')
  })

  it('SAVANNA with roll >= 0.7 → ROUND_OAK', () => {
    // rng=0.55 → roll = fract(0.55 * 1.32471...) ≈ 0.7291 ≥ 0.7
    expect(selectTreeArchetype('SAVANNA', LOW_SURFACE, 0.55)).toBe('ROUND_OAK')
  })

  it('BEACH with roll < 0.1 → ROUND_OAK', () => {
    // rng=0 → roll=0 < 0.1
    expect(selectTreeArchetype('BEACH', LOW_SURFACE, 0)).toBe('ROUND_OAK')
  })

  it('BEACH with roll >= 0.1 → TALL_BIRCH', () => {
    // rng=0.5 → roll ≈ 0.6624 ≥ 0.1
    expect(selectTreeArchetype('BEACH', LOW_SURFACE, 0.5)).toBe('TALL_BIRCH')
  })

  it('FOREST non-highland with roll < 0.42 → TALL_BIRCH', () => {
    // rng=0 → roll=0 < 0.42, non-highland surface
    expect(selectTreeArchetype('FOREST', LOW_SURFACE, 0)).toBe('TALL_BIRCH')
  })

  it('FOREST non-highland with roll >= 0.42 → ROUND_OAK', () => {
    // rng=0.5 → roll ≈ 0.6624 ≥ 0.42, non-highland surface
    expect(selectTreeArchetype('FOREST', LOW_SURFACE, 0.5)).toBe('ROUND_OAK')
  })

  it('SWAMP with roll >= 0.18 → ROUND_OAK', () => {
    // rng=0.5 → roll ≈ 0.6624 ≥ 0.18
    expect(selectTreeArchetype('SWAMP', LOW_SURFACE, 0.5)).toBe('ROUND_OAK')
  })

  it('default biome (e.g. DESERT) → ROUND_OAK', () => {
    expect(selectTreeArchetype('DESERT', LOW_SURFACE, 0)).toBe('ROUND_OAK')
    expect(selectTreeArchetype('RIVER', LOW_SURFACE, 0)).toBe('ROUND_OAK')
  })
})

// ---------------------------------------------------------------------------
// placeTree
// ---------------------------------------------------------------------------

describe('placeTree', () => {
  // Use a position safely inside the chunk (away from all borders)
  const LX = 8
  const LZ = 8
  const SURFACE_Y = 70

  it('places WOOD blocks (trunk) above surfaceY', () => {
    const blocks = makeBlocks()
    // Set surface to non-AIR so leaves won't overwrite surface block
    blocks[SURFACE_Y + LZ * CHUNK_HEIGHT + LX * CHUNK_HEIGHT * CHUNK_SIZE] = blockTypeToIndex('GRASS')
    placeTree(blocks, LX, LZ, SURFACE_Y, 'PLAINS', 0.5)

    const foundWood = Option.isSome(
      Arr.findFirst(Arr.makeBy(CHUNK_HEIGHT - SURFACE_Y - 1, i => SURFACE_Y + 1 + i), y => getBlock(blocks, LX, y, LZ) === WOOD_BLOCK_INDEX)
    )
    expect(foundWood).toBe(true)
  })

  it('a fully off-chunk tree origin writes nothing (bounds-clipped — no cross-column corruption)', () => {
    // placeChunkTrees iterates a canopy-margin-expanded grid, so it calls
    // placeTree with origins outside [0, CHUNK_SIZE). Every trunk/canopy voxel
    // of a far +z origin lands at lz >= CHUNK_SIZE and must be clipped. Without
    // the bounds guard the flat-index math (y + lz*H + lx*H*W) would wrap into a
    // valid in-chunk column and silently corrupt it — so an untouched all-AIR
    // chunk is the proof the clip holds.
    const blocks = makeBlocks()
    placeTree(blocks, 8, CHUNK_SIZE + 10, SURFACE_Y, 'PLAINS', 0.5)
    expect(blocks.every((b) => b === 0)).toBe(true)
  })

  it('places JUNGLE tree (TALL_CANOPY archetype) with wood in trunk column', () => {
    const blocks = makeBlocks()
    placeTree(blocks, LX, LZ, SURFACE_Y, 'JUNGLE', 0.7)

    const trunkBlocks = Arr.filter(Arr.makeBy(CHUNK_HEIGHT - SURFACE_Y - 1, i => SURFACE_Y + 1 + i), y => getBlock(blocks, LX, y, LZ) === WOOD_BLOCK_INDEX).length
    // TALL_CANOPY has 8..10 trunk blocks
    expect(trunkBlocks).toBeGreaterThanOrEqual(8)
  })

  it('places SNOW tree (SPRUCE archetype) with a trunk', () => {
    const blocks = makeBlocks()
    placeTree(blocks, LX, LZ, SURFACE_Y, 'SNOW', 0.3)

    const foundWood = Option.isSome(
      Arr.findFirst(Arr.makeBy(CHUNK_HEIGHT - SURFACE_Y - 1, i => SURFACE_Y + 1 + i), y => getBlock(blocks, LX, y, LZ) === WOOD_BLOCK_INDEX)
    )
    expect(foundWood).toBe(true)
  })

  it('places SAVANNA tree (ACACIA archetype) with a short trunk under a broad flat crown', () => {
    const blocks = makeBlocks()
    // rng=0 → roll < 0.7 → ACACIA; trunkHeight = ACACIA_TRUNK.baseHeight (5) at rng=0.
    placeTree(blocks, LX, LZ, SURFACE_Y, 'SAVANNA', 0)
    const LEAVES_INDEX = blockTypeToIndex('LEAVES')
    const canopyY = SURFACE_Y + 5 // trunk top / crown base

    // Trunk top is wood; the crown reaches radius 3 — wider than any round/oak canopy
    // (max radius 2), which is acacia's signature flat, wide umbrella silhouette.
    expect(getBlock(blocks, LX, canopyY, LZ)).toBe(WOOD_BLOCK_INDEX)
    expect(getBlock(blocks, LX + 3, canopyY, LZ)).toBe(LEAVES_INDEX)
    expect(getBlock(blocks, LX - 3, canopyY, LZ)).toBe(LEAVES_INDEX)
  })

  it('does not write out-of-chunk-bounds (no RangeError thrown)', () => {
    // Place a tree at a corner — some leaf placements will be OOB and should be silently skipped
    const blocks = makeBlocks()
    expect(() => placeTree(blocks, 0, 0, SURFACE_Y, 'PLAINS', 0.5)).not.toThrow()
  })

  it('leaves are only placed into AIR blocks (never overwrites solid blocks)', () => {
    const blocks = makeBlocks()
    // Fill the entire chunk with STONE
    blocks.fill(blockTypeToIndex('STONE'))
    placeTree(blocks, LX, LZ, SURFACE_Y, 'PLAINS', 0.5)

    // Only trunk positions (WOOD) and the stone below should remain — no LEAVES placed
    const LEAVES_INDEX = blockTypeToIndex('LEAVES')
    expect(Arr.some(Arr.fromIterable(blocks), b => b === LEAVES_INDEX)).toBe(false)
  })

  it('places TALL_BIRCH tree (PLAINS, rng=0) with a trunk', () => {
    // PLAINS + rng=0 → roll=0 < 0.28 → TALL_BIRCH archetype
    const blocks = makeBlocks()
    placeTree(blocks, LX, LZ, SURFACE_Y, 'PLAINS', 0)

    const foundWood = Option.isSome(
      Arr.findFirst(Arr.makeBy(CHUNK_HEIGHT - SURFACE_Y - 1, i => SURFACE_Y + 1 + i), y => getBlock(blocks, LX, y, LZ) === WOOD_BLOCK_INDEX)
    )
    expect(foundWood).toBe(true)
  })

  it('places ROUND_OAK tree (ROUND_OAK archetype) with a trunk', () => {
    // SWAMP + rng=0.5 → roll ≈ 0.6624 ≥ 0.18 → ROUND_OAK archetype
    const blocks = makeBlocks()
    placeTree(blocks, LX, LZ, SURFACE_Y, 'SWAMP', 0.5)

    const foundWood = Option.isSome(
      Arr.findFirst(Arr.makeBy(CHUNK_HEIGHT - SURFACE_Y - 1, i => SURFACE_Y + 1 + i), y => getBlock(blocks, LX, y, LZ) === WOOD_BLOCK_INDEX)
    )
    expect(foundWood).toBe(true)
  })
})
