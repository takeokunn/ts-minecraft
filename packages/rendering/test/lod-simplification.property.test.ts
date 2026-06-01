import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import * as fc from 'fast-check'
import { Array as Arr, Option } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world'
import { greedyMeshChunk, simplifyMesh, lodForDistance } from '@ts-minecraft/rendering'
import { createLightBuffer, setLightAt } from '@ts-minecraft/world'
import type { LightGrids } from '@ts-minecraft/world'

const DIRT_ID = blockTypeToIndex('DIRT')

const blocksFromCoords = (coords: ReadonlyArray<readonly [number, number, number]>): Uint8Array => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  Arr.forEach(coords, ([lx, y, lz]) => {
    blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] = DIRT_ID
  })
  return blocks
}

const arbCoord = fc.tuple(
  fc.integer({ min: 0, max: CHUNK_SIZE - 1 }),
  fc.integer({ min: 0, max: 30 }), // keep Y modest to avoid huge meshes
  fc.integer({ min: 0, max: CHUNK_SIZE - 1 }),
)

const arbBlocks = fc.array(arbCoord, { minLength: 1, maxLength: 30 }).map(blocksFromCoords)

const makeChunk = (blocks: Uint8Array): Chunk => ({
  coord: { x: 0, z: 0 },
  blocks,
  fluid: Option.none(),
})

describe('simplifyMesh — properties', () => {
  it('LOD simplification never grows the buffer (positions / indices)', () => {
    fc.assert(
      fc.property(arbBlocks, fc.constantFrom(1 as const, 2 as const), (blocks, lod) => {
        const meshed = greedyMeshChunk(makeChunk(blocks), { wx: 0, wz: 0 }).toMeshed().opaque
        const simplified = simplifyMesh(meshed, lod)
        expect(simplified.positions.length).toBeLessThanOrEqual(meshed.positions.length)
        expect(simplified.indices.length).toBeLessThanOrEqual(meshed.indices.length)
      }),
      { numRuns: 30 },
    )
    // CPU-heavy: each fast-check run meshes a full 16×16×256 chunk then
    // simplifies it. ~1.5s in isolation, but under full-suite 16-worker
    // contention it can balloon past the 10s default timeout → a flaky timeout
    // (the assertion itself is structurally guaranteed — simplifyMesh rebuilds
    // quads 1:1 and never grows the buffer). Generous timeout removes the flake
    // without reducing coverage.
  }, 30_000)

  it('LOD 2 merges coincident snapped quads, strictly reducing geometry', () => {
    // Two DIRT blocks at x=0 and x=2 (gap at x=1) → greedy keeps them as
    // separate quads. At LOD 2 (step 4) their top, bottom, and ±Z faces all snap
    // to the same [0,4] grid cell, so each pair dedups to one quad. The opposing
    // ±X faces sit at different X planes and stay distinct. Net: 12 quads → 8.
    const blocks = blocksFromCoords([[0, 0, 0], [2, 0, 0]])
    const meshed = greedyMeshChunk(makeChunk(blocks), { wx: 0, wz: 0 }).toMeshed().opaque
    const simplified = simplifyMesh(meshed, 2)

    // Real vertex reduction — the LOD is no longer cosmetic.
    expect(simplified.positions.length).toBeLessThan(meshed.positions.length)
    // Geometry stays well-formed: 4 verts / 6 indices per surviving quad.
    expect(simplified.positions.length % 12).toBe(0)
    expect(simplified.indices.length / 6).toBe(simplified.positions.length / 12)
    // Concretely: 12 input quads → 8 after merging the 4 coincident pairs.
    expect(meshed.positions.length / 12).toBe(12)
    expect(simplified.positions.length / 12).toBe(8)
  })

  it('reclaims geometry on a flat slab whose faces are split by lighting variation (real-terrain case)', () => {
    // The realistic case: a flat surface that greedy would merge into one quad
    // under uniform light gets split into many small quads when per-block
    // lighting varies — and that is exactly where distant-chunk LOD should pay
    // off. Flat 8×8 DIRT slab at y=0.
    const coords: Array<readonly [number, number, number]> = []
    for (let lx = 0; lx < 8; lx += 1) for (let lz = 0; lz < 8; lz += 1) coords.push([lx, 0, lz])
    const chunk = makeChunk(blocksFromCoords(coords))

    // Uniform light (default: sky=15, block=0) → greedy merges the top surface.
    const uniform = greedyMeshChunk(chunk, { wx: 0, wz: 0 }).toMeshed().opaque

    // Same geometry, but a checkerboard of block-light in the air layer above the
    // slab — differs from uniform ONLY in block-light, isolating the cause.
    const skyLight = createLightBuffer()
    const blockLight = createLightBuffer()
    for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
        for (let y = 0; y < CHUNK_HEIGHT; y += 1) setLightAt(skyLight, lx, y, lz, 15)
        // 2×2-block checkerboard: light is uniform within each 2×2 group (so the
        // 2×2 corner-light sampling doesn't average it away) but alternates
        // between groups, forcing greedy to emit one quad per 2×2 group. Four
        // such groups tile each step-4 LOD cell → they snap together and dedup.
        setLightAt(blockLight, lx, 1, lz, ((Math.floor(lx / 2) + Math.floor(lz / 2)) % 2) * 15)
      }
    }
    const grids: LightGrids = { skyLight, blockLight }
    const varying = greedyMeshChunk(chunk, { wx: 0, wz: 0 }, new Set(), undefined, grids).toMeshed().opaque

    // Premise: lighting variation forces greedy to split the surface into more quads.
    expect(varying.positions.length).toBeGreaterThan(uniform.positions.length)

    // Payoff: LOD dedups the snapped split faces, reclaiming a large fraction of
    // the geometry distant chunks would otherwise pay for. Reduction deepens with
    // LOD level (step 2 → step 4), matching the module's ~30% / ~10% targets.
    const lod1 = simplifyMesh(varying, 1)
    const lod2 = simplifyMesh(varying, 2)
    expect(lod1.positions.length).toBeLessThan(varying.positions.length)
    expect(lod2.positions.length).toBeLessThan(lod1.positions.length)
    // Substantial, not token: LOD 2 sheds well over half the geometry here.
    expect(lod2.positions.length).toBeLessThan(varying.positions.length / 2)
  })

  it('quad / vertex / index counts stay aligned (4 verts per quad, 6 indices per quad)', () => {
    fc.assert(
      fc.property(arbBlocks, fc.constantFrom(0 as const, 1 as const, 2 as const), (blocks, lod) => {
        const meshed = greedyMeshChunk(makeChunk(blocks), { wx: 0, wz: 0 }).toMeshed().opaque
        const simplified = simplifyMesh(meshed, lod)
        expect(simplified.positions.length % 12).toBe(0)
        expect(simplified.indices.length % 6).toBe(0)
        expect(simplified.indices.length / 6).toBe(simplified.positions.length / 12)
      }),
      { numRuns: 30 },
    )
    // Same CPU-heavy mesh+simplify pattern as above — generous timeout to avoid
    // a flaky timeout under parallel-worker contention.
  }, 30_000)

  it('lodForDistance is monotonically non-decreasing in distance', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 32, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: 0, max: 32, noNaN: true, noDefaultInfinity: true }),
        (a, b) => {
          if (a <= b) {
            expect(lodForDistance(a)).toBeLessThanOrEqual(lodForDistance(b))
          } else {
            expect(lodForDistance(b)).toBeLessThanOrEqual(lodForDistance(a))
          }
        },
      ),
      { numRuns: 50 },
    )
  })
})
