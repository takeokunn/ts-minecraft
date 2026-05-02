import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect } from 'effect'
import { NoiseService } from '@ts-minecraft/noise-generator'

// ---------------------------------------------------------------------------
// Phase 2.1c: Terrain-channel noise (C / E / PV / J)
// ---------------------------------------------------------------------------

// Dense-grid index: out[z * 16 + x] for a 16x16 channel buffer.
// Helper preserves the explicit z-stride * 16 documentation across call sites
// while keeping the iy=0 row-base out of `0 * 16` lint-warned form.
const denseIdx = (z: number, x: number): number => z * 16 + x

describe('infrastructure/noise/noise-service — terrain channels', () => {
  describe('sampleTerrainChannels — shape & determinism', () => {
    it.effect('returns four Float64Array of length 256 each', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(42)
        const out = yield* service.sampleTerrainChannels(0, 0)
        expect(out.continentalness).toBeInstanceOf(Float64Array)
        expect(out.erosion).toBeInstanceOf(Float64Array)
        expect(out.pv).toBeInstanceOf(Float64Array)
        expect(out.jaggedness).toBeInstanceOf(Float64Array)
        expect(out.continentalness.length).toBe(256)
        expect(out.erosion.length).toBe(256)
        expect(out.pv.length).toBe(256)
        expect(out.jaggedness.length).toBe(256)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('determinism: two consecutive calls at same (xStart, zStart) + seed return identical values', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(1337)
        const a = yield* service.sampleTerrainChannels(32, -16)
        const b = yield* service.sampleTerrainChannels(32, -16)
        Arr.forEach(Arr.makeBy(256, (i) => i), (i) => {
          expect(a.continentalness[i]).toBe(b.continentalness[i])
          expect(a.erosion[i]).toBe(b.erosion[i])
          expect(a.pv[i]).toBe(b.pv[i])
          expect(a.jaggedness[i]).toBe(b.jaggedness[i])
        })
      }).pipe(Effect.provide(NoiseService.Default))
    )
  })

  describe('seed decorrelation', () => {
    it.effect('continentalness(0,0) ≠ erosion(0,0) under the same seed', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(2026)
        const c = yield* service.continentalness(0, 0)
        const e = yield* service.erosion(0, 0)
        expect(Math.abs(c - e)).toBeGreaterThan(1e-6)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('all four individual channels produce distinct values at (0,0) with the same seed', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(2026)
        const c = yield* service.continentalness(0, 0)
        const e = yield* service.erosion(0, 0)
        const w = yield* service.weirdness(0, 0)
        const j = yield* service.jaggedness(0, 0)
        // Pairwise distinct (probabilistic — all four Perlin instances have different gradient tables).
        expect(Math.abs(c - e)).toBeGreaterThan(1e-6)
        expect(Math.abs(c - w)).toBeGreaterThan(1e-6)
        expect(Math.abs(c - j)).toBeGreaterThan(1e-6)
        expect(Math.abs(e - w)).toBeGreaterThan(1e-6)
        expect(Math.abs(e - j)).toBeGreaterThan(1e-6)
        expect(Math.abs(w - j)).toBeGreaterThan(1e-6)
      }).pipe(Effect.provide(NoiseService.Default))
    )
  })

  describe('sparse-grid continuity — bilinear interpolation', () => {
    it.effect('interpolated value at odd-x lies between the two adjacent even-x samples (same z, z even)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(7)
        const xStart = 0
        const zStart = 0
        const out = yield* service.sampleTerrainChannels(xStart, zStart)
        // For odd x in [1,3,5,...,15], z=0: value should lie between (x-1,z=0) and (x+1,z=0).
        // Note: x=15 has no upstream even neighbour within the 16-cell dense grid, but the
        // bilinear formula with fx=0.5 still averages sparse corners six=7 and six=8, which
        // ARE the neighbours at world-x = xStart+14 and xStart+16. So the even neighbours
        // to compare against for x=15 are the dense cell (x=14) and the sparse-grid corner
        // at sparse-x=8 (beyond the dense grid). We only check x in {1,3,5,...,13} to keep
        // the neighbour pair inside the dense output.
        // Index layout: z * 16 + x.
        Arr.forEach(['continentalness', 'erosion', 'pv', 'jaggedness'] as const, (channel) => {
          const arr = out[channel]
          Arr.forEach([1, 3, 5, 7, 9, 11, 13] as const, (x) => {
            const mid = arr[denseIdx(0, x)]!
            const lo = arr[denseIdx(0, x - 1)]!
            const hi = arr[denseIdx(0, x + 1)]!
            const min = Math.min(lo, hi)
            const max = Math.max(lo, hi)
            // Tiny epsilon guards against float-rounding at the exact endpoints.
            expect(mid).toBeGreaterThanOrEqual(min - 1e-12)
            expect(mid).toBeLessThanOrEqual(max + 1e-12)
          })
        })
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('even-indexed cells match the sparse corner samples (no interpolation at fx=fz=0)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(99)
        const xStart = 64
        const zStart = -32
        const out = yield* service.sampleTerrainChannels(xStart, zStart)
        // At (x=0, z=0) the dense output equals the sparse corner (sx=0, sz=0) which is the
        // raw noise at world-space (xStart, zStart). Index: z*16 + x.
        const rawC = yield* service.continentalness(xStart, zStart)
        expect(out.continentalness[denseIdx(0, 0)]).toBeCloseTo(rawC, 12)
        // Likewise at (x=2, z=2) → sparse corner (sx=1, sz=1) = world (xStart+2, zStart+2).
        const rawC22 = yield* service.continentalness(xStart + 2, zStart + 2)
        expect(out.continentalness[2 * 16 + 2]).toBeCloseTo(rawC22, 12)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('producer/consumer index agreement: out[z*16+x] at sparse-grid (lx=2, lz=4) matches direct continentalness(2,4)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(54321)
        const out = yield* service.sampleTerrainChannels(0, 0)
        // (lx=2, lz=4) lands on a sparse-grid sample point (step=2), so no
        // bilinear blending — the dense output equals the raw direct sample.
        // Producer writes at z*16+x = 4*16+2 = 66; consumer (density-function.ts)
        // reads with the same index. This pins down that the two agree.
        const lx = 2
        const lz = 4
        const direct = yield* service.continentalness(lx, lz)
        expect(out.continentalness[lz * 16 + lx]).toBe(direct)
      }).pipe(Effect.provide(NoiseService.Default))
    )
  })

  describe('PV formula — pv = 1 - |3|w| - 2|', () => {
    it.effect('PV at an even-x/even-z cell matches the formula applied to weirdness(x,z)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(12345)
        const xStart = 128
        const zStart = 256
        const out = yield* service.sampleTerrainChannels(xStart, zStart)
        // At (lx=4, lz=6), sparse corner → world (xStart+4, zStart+6); no bilinear blending.
        // Index: lz*16 + lx = 6*16 + 4 = 100.
        const w = yield* service.weirdness(xStart + 4, zStart + 6)
        const expected = 1 - Math.abs(3 * Math.abs(w) - 2)
        expect(out.pv[6 * 16 + 4]).toBeCloseTo(expected, 12)
      }).pipe(Effect.provide(NoiseService.Default))
    )
  })
})
