import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndexUnsafe, blockTypeToIndex } from '@ts-minecraft/core'
import { ChunkService, ChunkServiceLive } from '@ts-minecraft/world'
import type { ChunkService as ChunkServiceType } from '@ts-minecraft/world'
import { getLightAt, LIGHT_LEVEL_MAX } from '@ts-minecraft/world'
import { FULL_RECOMPUTE_THRESHOLD, LightEngineLive, LightEngineService } from '@ts-minecraft/world'

const STONE = blockTypeToIndex('STONE')
const LAVA = blockTypeToIndex('LAVA')

interface MutableChunk {
  skyLight?: Uint8Array
  blockLight?: Uint8Array
}

const withLightService = <A>(
  f: (cs: ChunkServiceType, ls: LightEngineService) => Effect.Effect<A, never>,
): Effect.Effect<A, never> =>
  Effect.all([ChunkService, LightEngineService]).pipe(
    Effect.flatMap(([cs, ls]) => f(cs, ls)),
    Effect.provide(Layer.mergeAll(ChunkServiceLive, LightEngineLive)),
  )

describe('application/light/light-engine-bfs (FR-3.4)', () => {
  it.effect('first call (no prior light) falls back to full compute and reports all-boundary dirty', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const result = yield* ls.propagateLightIncremental(chunk, [{ lx: 8, y: 100, lz: 8 }])
        expect(result.skyLight.byteLength).toBe(16 * 16 * 256 / 2)
        expect(result.blockLight.byteLength).toBe(16 * 16 * 256 / 2)
        // First-time bake reports all 4 cardinal boundaries dirty so caller
        // can re-mesh all neighbors.
        expect(result.boundary.nx).toBe(true)
        expect(result.boundary.px).toBe(true)
        expect(result.boundary.nz).toBe(true)
        expect(result.boundary.pz).toBe(true)
      }),
    ),
  )

  it.effect('empty dirty list with prior light is a no-op', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const baseline = yield* ls.updateLight(chunk)
        ;(chunk as MutableChunk).skyLight = baseline.skyLight
        ;(chunk as MutableChunk).blockLight = baseline.blockLight
        const result = yield* ls.propagateLightIncremental(chunk, [])
        expect(result.boundary.nx).toBe(false)
        expect(result.boundary.px).toBe(false)
        expect(result.boundary.nz).toBe(false)
        expect(result.boundary.pz).toBe(false)
      }),
    ),
  )

  it.effect('add LAVA: incremental BFS produces correct attenuation pattern', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        // Bake initial empty-chunk lighting
        const baseline = yield* ls.updateLight(chunk)
        ;(chunk as MutableChunk).skyLight = baseline.skyLight
        ;(chunk as MutableChunk).blockLight = baseline.blockLight
        // Mutate: place LAVA at center
        chunk.blocks[blockIndexUnsafe(8, 100, 8)] = LAVA
        const result = yield* ls.propagateLightIncremental(chunk, [{ lx: 8, y: 100, lz: 8 }])
        expect(getLightAt(result.blockLight, 8, 100, 8)).toBe(15)
        expect(getLightAt(result.blockLight, 9, 100, 8)).toBe(14)
        expect(getLightAt(result.blockLight, 8, 100, 10)).toBe(13)
        expect(getLightAt(result.blockLight, 8, 100, 11)).toBe(12)
      }),
    ),
  )

  it.effect('remove LAVA: incremental BFS darkens previously-lit voxels', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        chunk.blocks[blockIndexUnsafe(8, 100, 8)] = LAVA
        const baseline = yield* ls.updateLight(chunk)
        ;(chunk as MutableChunk).skyLight = baseline.skyLight
        ;(chunk as MutableChunk).blockLight = baseline.blockLight
        // Sanity: BFS should have lit neighbors
        expect(getLightAt(baseline.blockLight, 9, 100, 8)).toBe(14)
        // Remove LAVA → AIR
        chunk.blocks[blockIndexUnsafe(8, 100, 8)] = 0
        const result = yield* ls.propagateLightIncremental(chunk, [{ lx: 8, y: 100, lz: 8 }])
        expect(getLightAt(result.blockLight, 8, 100, 8)).toBe(0)
        expect(getLightAt(result.blockLight, 9, 100, 8)).toBe(0)
        expect(getLightAt(result.blockLight, 8, 100, 11)).toBe(0)
      }),
    ),
  )

  it.effect('place STONE at sky-exposed voxel: removes sky light below within column', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const baseline = yield* ls.updateLight(chunk)
        ;(chunk as MutableChunk).skyLight = baseline.skyLight
        ;(chunk as MutableChunk).blockLight = baseline.blockLight
        // Sanity: column is fully sky-lit pre-edit
        expect(getLightAt(baseline.skyLight, 5, 200, 5)).toBe(LIGHT_LEVEL_MAX)
        expect(getLightAt(baseline.skyLight, 5, 100, 5)).toBe(LIGHT_LEVEL_MAX)
        // Place STONE at y=200 — voxels below should darken on full re-light
        chunk.blocks[blockIndexUnsafe(5, 200, 5)] = STONE
        const result = yield* ls.propagateLightIncremental(chunk, [{ lx: 5, y: 200, lz: 5 }])
        // The newly-opaque voxel itself: 0
        expect(getLightAt(result.skyLight, 5, 200, 5)).toBe(0)
      }),
    ),
  )

  it.effect('boundary report: dirty voxel adjacent to +x edge marks boundary.px', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const baseline = yield* ls.updateLight(chunk)
        ;(chunk as MutableChunk).skyLight = baseline.skyLight
        ;(chunk as MutableChunk).blockLight = baseline.blockLight
        // Place LAVA right at x=15 (the +x boundary)
        chunk.blocks[blockIndexUnsafe(15, 100, 8)] = LAVA
        const result = yield* ls.propagateLightIncremental(chunk, [{ lx: 15, y: 100, lz: 8 }])
        // BFS at x=15 immediately attempts to step into x=16 → boundary.px set
        expect(result.boundary.px).toBe(true)
      }),
    ),
  )

  it.effect('out-of-bounds dirty voxels are filtered (boundary remains clean for empty edits)', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const baseline = yield* ls.updateLight(chunk)
        ;(chunk as MutableChunk).skyLight = baseline.skyLight
        ;(chunk as MutableChunk).blockLight = baseline.blockLight
        const result = yield* ls.propagateLightIncremental(chunk, [
          { lx: -1, y: 100, lz: 8 },
          { lx: 99, y: 100, lz: 8 },
          { lx: 5, y: -1, lz: 5 },
          { lx: 5, y: CHUNK_HEIGHT, lz: 5 },
          { lx: 5, y: 50, lz: CHUNK_SIZE },
        ])
        // All filtered → no propagation → no boundaries touched
        expect(result.boundary.nx).toBe(false)
        expect(result.boundary.px).toBe(false)
        expect(result.boundary.nz).toBe(false)
        expect(result.boundary.pz).toBe(false)
      }),
    ),
  )

  it.effect('multiple dirty voxels in same column dedupe column re-walk', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const baseline = yield* ls.updateLight(chunk)
        ;(chunk as MutableChunk).skyLight = baseline.skyLight
        ;(chunk as MutableChunk).blockLight = baseline.blockLight
        chunk.blocks[blockIndexUnsafe(5, 100, 5)] = STONE
        chunk.blocks[blockIndexUnsafe(5, 50, 5)] = STONE
        // Two edits in same (lx=5, lz=5) column — incremental BFS should
        // process both correctly (column re-walk dedup is internal).
        const result = yield* ls.propagateLightIncremental(chunk, [
          { lx: 5, y: 100, lz: 5 },
          { lx: 5, y: 50, lz: 5 },
        ])
        expect(getLightAt(result.skyLight, 5, 100, 5)).toBe(0)
        expect(getLightAt(result.skyLight, 5, 50, 5)).toBe(0)
      }),
    ),
  )

  it.effect('add then immediately remove LAVA returns chunk to pre-edit lighting', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const baseline = yield* ls.updateLight(chunk)
        ;(chunk as MutableChunk).skyLight = baseline.skyLight
        ;(chunk as MutableChunk).blockLight = baseline.blockLight
        // Snapshot pre-edit block-light at a witness voxel
        const beforeAt = getLightAt(baseline.blockLight, 9, 100, 8)
        // Place LAVA, run BFS, then remove and run BFS again
        chunk.blocks[blockIndexUnsafe(8, 100, 8)] = LAVA
        yield* ls.propagateLightIncremental(chunk, [{ lx: 8, y: 100, lz: 8 }])
        chunk.blocks[blockIndexUnsafe(8, 100, 8)] = 0
        const result = yield* ls.propagateLightIncremental(chunk, [{ lx: 8, y: 100, lz: 8 }])
        const afterAt = getLightAt(result.blockLight, 9, 100, 8)
        expect(afterAt).toBe(beforeAt)
        expect(getLightAt(result.blockLight, 8, 100, 8)).toBe(0)
      }),
    ),
  )

  // SEC-W1: Past FULL_RECOMPUTE_THRESHOLD (256), the BFS removal/add queue can
  // balloon to 6 MB peak — fall back to bounded O(n) full re-compute and report
  // all-boundary dirty so callers re-mesh all neighbors.
  it.effect('falls back to full recompute when dirtyVoxels exceed FULL_RECOMPUTE_THRESHOLD (DoS cap)', () =>
    withLightService((cs, ls) =>
      Effect.gen(function* () {
        const chunk = yield* cs.createChunk({ x: 0, z: 0 })
        const baseline = yield* ls.updateLight(chunk)
        ;(chunk as MutableChunk).skyLight = baseline.skyLight
        ;(chunk as MutableChunk).blockLight = baseline.blockLight

        // Build 257 in-bounds voxels (one over the threshold).
        const overCap = FULL_RECOMPUTE_THRESHOLD + 1
        const dirty: Array<{ lx: number; y: number; lz: number }> = []
        for (let i = 0; i < overCap; i++) {
          dirty.push({ lx: i % CHUNK_SIZE, y: 100 + Math.floor(i / CHUNK_SIZE), lz: 0 })
        }

        const result = yield* ls.propagateLightIncremental(chunk, dirty)

        // Cap path reports all-boundary dirty (full recompute may have changed any edge voxel).
        expect(result.boundary.nx).toBe(true)
        expect(result.boundary.px).toBe(true)
        expect(result.boundary.nz).toBe(true)
        expect(result.boundary.pz).toBe(true)

        // And the result equals the full updateLight output (idempotent — blocks unchanged).
        const fresh = yield* ls.updateLight(chunk)
        expect(getLightAt(result.skyLight, 8, CHUNK_HEIGHT - 1, 8)).toBe(getLightAt(fresh.skyLight, 8, CHUNK_HEIGHT - 1, 8))
        expect(getLightAt(result.blockLight, 0, 0, 0)).toBe(getLightAt(fresh.blockLight, 0, 0, 0))
      }),
    ),
  )
})
