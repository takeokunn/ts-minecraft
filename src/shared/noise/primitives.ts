/**
 * Pure synchronous noise primitives.
 *
 * Single source of truth for the deterministic noise functions used by both
 * `infrastructure/noise/NoiseService` (Effect-wrapped) and the off-thread
 * `application/terrain/terrain-generation` worker pipeline.
 *
 * Self-contained: imports only `effect/Array` for lightweight functional
 * helpers and the existing `infrastructure/noise/perlin` core (Ken Perlin
 * "Improved Noise" 2D + 3D), which is itself dependency-free apart from
 * `Option` for an optional rand fallback.
 *
 * Determinism contract:
 *   For a given `seed: number`, `createNoisePrimitives(seed)` returns a struct
 *   whose method outputs are byte-identical to the corresponding methods on
 *   `NoiseService` after `setSeed(seed)`. This guarantee is enforced by
 *   `noise-service.ts` delegating to this module, and by the parity property
 *   test in `infrastructure/terrain/terrain-worker-pool.parity.property.test.ts`.
 */
import { Array as Arr } from 'effect'
import {
  createPerlinNoise2D,
  createPerlinNoise3D,
  type NoiseFn2D,
  type NoiseFn3D,
  type RandFn,
} from '@/infrastructure/noise/perlin'

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

/** Mulberry32 — deterministic, cheap, uniform [0,1) generator. */
export const mulberry32 = (seed: number): RandFn => {
  let s = seed >>> 0
  return () => {
    let t = (s += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Map 2D Perlin output from [-1, 1] to [0, 1]. */
export const normalizeNoise = (value: number): number => (value + 1) / 2

// Weyl-constant XORs decorrelate per-channel Perlin seeds while keeping every
// derived seed inside uint32 range. Identical to the constants previously
// defined in `infrastructure/noise/noise-service.ts` — moved here so both the
// Effect service and the pure terrain worker can share them.
export const WEYL_C = 0x9e3779b1
export const WEYL_E = 0xbb67ae85
export const WEYL_W = 0x3c6ef372
export const WEYL_J = 0xa54ff53a
export const WEYL_3D = 0x9e3779b9 // 3D-vs-2D decorrelation offset

// Terrain-channel world-space frequencies (blocks^-1).
export const SCALE_C = 0.0005
export const SCALE_E = 0.001
export const SCALE_W = 0.002
export const SCALE_J = 0.02

/** Peaks-and-valleys transform of the weirdness channel: pv = 1 - |3|w| - 2|. */
export const toPV = (w: number): number => 1 - Math.abs(3 * Math.abs(w) - 2)

// ---------------------------------------------------------------------------
// Octave-noise core. Pure: takes a `NoiseFn2D` and a sample point.
// Output range matches `noise-service.ts computeOctaveNoise` exactly.
// ---------------------------------------------------------------------------
export const computeOctaveNoise = (
  noiseFn: NoiseFn2D,
  x: number,
  z: number,
  octaves: number,
  persistence: number,
  lacunarity: number,
): number => {
  if (octaves < 1) return 0
  let total = 0
  let frequency = 1
  let amplitude = 1
  let maxValue = 0

  // Hot inner loop — kept as `for` to avoid per-iteration closure allocation
  // in a function called millions of times per chunk.
  for (let i = 0; i < octaves; i++) {
    total += noiseFn(x * frequency, z * frequency) * amplitude
    maxValue += amplitude
    amplitude *= persistence
    frequency *= lacunarity
  }

  return normalizeNoise(total / maxValue)
}

// ---------------------------------------------------------------------------
// Sparse-grid bilinear-interpolated terrain channel sampler. Output bit-
// identical to `noise-service.ts sampleTerrainChannels`. Indexed `z*16 + x`.
// ---------------------------------------------------------------------------
export type TerrainChannelSamples = Readonly<{
  continentalness: Float64Array
  erosion: Float64Array
  pv: Float64Array
  jaggedness: Float64Array
}>

export const computeTerrainChannels = (
  noiseFnContinentalness: NoiseFn2D,
  noiseFnErosion: NoiseFn2D,
  noiseFnWeirdness: NoiseFn2D,
  noiseFnJaggedness: NoiseFn2D,
  xStart: number,
  zStart: number,
): TerrainChannelSamples => {
  // Sparse 9×9 corner grid — N+1 for bilinear over 16 cells with step=2.
  const SPARSE = 9
  const STEP = 2
  const sparseC = new Float64Array(SPARSE * SPARSE)
  const sparseE = new Float64Array(SPARSE * SPARSE)
  const sparseW = new Float64Array(SPARSE * SPARSE)
  const sparseJ = new Float64Array(SPARSE * SPARSE)

  for (let sx = 0; sx < SPARSE; sx++) {
    const wx = xStart + sx * STEP
    for (let sz = 0; sz < SPARSE; sz++) {
      const wz = zStart + sz * STEP
      const si = sx * SPARSE + sz
      sparseC[si] = noiseFnContinentalness(wx * SCALE_C, wz * SCALE_C)
      sparseE[si] = noiseFnErosion(wx * SCALE_E, wz * SCALE_E)
      sparseW[si] = noiseFnWeirdness(wx * SCALE_W, wz * SCALE_W)
      sparseJ[si] = noiseFnJaggedness(wx * SCALE_J, wz * SCALE_J)
    }
  }

  // Dense 16×16 output via bilinear interpolation. Index: z * 16 + x.
  const continentalness = new Float64Array(256)
  const erosion = new Float64Array(256)
  const pv = new Float64Array(256)
  const jaggedness = new Float64Array(256)

  for (let z = 0; z < 16; z++) {
    const siz = z >> 1
    const fz = (z & 1) / 2
    const inv_fz = 1 - fz
    for (let x = 0; x < 16; x++) {
      const six = x >> 1
      const fx = (x & 1) / 2
      const inv_fx = 1 - fx

      const i00 = six * SPARSE + siz
      const i10 = (six + 1) * SPARSE + siz
      const i01 = six * SPARSE + (siz + 1)
      const i11 = (six + 1) * SPARSE + (siz + 1)

      const w00 = inv_fx * inv_fz
      const w10 = fx * inv_fz
      const w01 = inv_fx * fz
      const w11 = fx * fz

      const c = w00 * sparseC[i00]! + w10 * sparseC[i10]! + w01 * sparseC[i01]! + w11 * sparseC[i11]!
      const e = w00 * sparseE[i00]! + w10 * sparseE[i10]! + w01 * sparseE[i01]! + w11 * sparseE[i11]!
      const w = w00 * sparseW[i00]! + w10 * sparseW[i10]! + w01 * sparseW[i01]! + w11 * sparseW[i11]!
      const j = w00 * sparseJ[i00]! + w10 * sparseJ[i10]! + w01 * sparseJ[i01]! + w11 * sparseJ[i11]!

      const out = z * 16 + x
      continentalness[out] = c
      erosion[out] = e
      pv[out] = toPV(w)
      jaggedness[out] = j
    }
  }

  return { continentalness, erosion, pv, jaggedness }
}

// ---------------------------------------------------------------------------
// Bundle of pre-seeded noise functions + every derived sampler. The single
// source of truth for "what does seed=N produce".
// ---------------------------------------------------------------------------
export type NoisePrimitives = Readonly<{
  /** Base 2D Perlin sampled directly (range ≈ [-1, 1]). */
  raw2D: NoiseFn2D
  /** Base 3D Perlin sampled directly (range ≈ [-1, 1]). */
  raw3D: NoiseFn3D
  /** Per-channel 2D Perlin instances. */
  continentalness: NoiseFn2D
  erosion: NoiseFn2D
  weirdness: NoiseFn2D
  jaggedness: NoiseFn2D
  /** noise2D normalised to [0, 1]. */
  noise2D: (x: number, z: number) => number
  /** Multi-octave normalised noise. */
  octaveNoise2D: (
    x: number,
    z: number,
    octaves: number,
    persistence: number,
    lacunarity: number,
  ) => number
  /** Raw 3D Perlin (range ≈ [-1, 1]). */
  noise3D: (x: number, y: number, z: number) => number
  /** Continentalness sampler — internally applies SCALE_C. */
  continentalnessAt: (x: number, z: number) => number
  erosionAt: (x: number, z: number) => number
  weirdnessAt: (x: number, z: number) => number
  jaggednessAt: (x: number, z: number) => number
  /** Sparse-grid bilinear terrain channels. */
  sampleTerrainChannels: (xStart: number, zStart: number) => TerrainChannelSamples
}>

export const createNoisePrimitives = (seed: number): NoisePrimitives => {
  // Seed each Perlin grid via a Weyl-constant-decorrelated mulberry32 stream.
  const raw2D = createPerlinNoise2D(mulberry32(seed))
  const raw3D = createPerlinNoise3D(mulberry32((seed ^ WEYL_3D) >>> 0))
  const continentalness = createPerlinNoise2D(mulberry32((seed ^ WEYL_C) >>> 0))
  const erosion = createPerlinNoise2D(mulberry32((seed ^ WEYL_E) >>> 0))
  const weirdness = createPerlinNoise2D(mulberry32((seed ^ WEYL_W) >>> 0))
  const jaggedness = createPerlinNoise2D(mulberry32((seed ^ WEYL_J) >>> 0))

  return {
    raw2D,
    raw3D,
    continentalness,
    erosion,
    weirdness,
    jaggedness,
    noise2D: (x, z) => normalizeNoise(raw2D(x, z)),
    octaveNoise2D: (x, z, octaves, persistence, lacunarity) =>
      computeOctaveNoise(raw2D, x, z, octaves, persistence, lacunarity),
    noise3D: (x, y, z) => raw3D(x, y, z),
    continentalnessAt: (x, z) => continentalness(x * SCALE_C, z * SCALE_C),
    erosionAt: (x, z) => erosion(x * SCALE_E, z * SCALE_E),
    weirdnessAt: (x, z) => weirdness(x * SCALE_W, z * SCALE_W),
    jaggednessAt: (x, z) => jaggedness(x * SCALE_J, z * SCALE_J),
    sampleTerrainChannels: (xStart, zStart) =>
      computeTerrainChannels(continentalness, erosion, weirdness, jaggedness, xStart, zStart),
  }
}

// ---------------------------------------------------------------------------
// Batch helpers — convenience wrappers that build typed arrays from the
// primitives. Used by both `noise-service.ts` (to satisfy the Effect API
// surface) and the worker (to mirror the same shape).
// ---------------------------------------------------------------------------
export const noise2DBatchXY = (
  primitives: NoisePrimitives,
  xs: ReadonlyArray<number>,
  zs: ReadonlyArray<number>,
): ReadonlyArray<number> =>
  Arr.makeBy(xs.length, (i) => primitives.noise2D(xs[i]!, zs[i]!))

export const noise3DBatchXYZ = (
  primitives: NoisePrimitives,
  xs: ReadonlyArray<number>,
  ys: ReadonlyArray<number>,
  zs: ReadonlyArray<number>,
): ReadonlyArray<number> =>
  Arr.makeBy(xs.length, (i) => primitives.noise3D(xs[i]!, ys[i]!, zs[i]!))

export const octaveNoise2DBatchXY = (
  primitives: NoisePrimitives,
  xs: ReadonlyArray<number>,
  zs: ReadonlyArray<number>,
  octaves: number,
  persistence: number,
  lacunarity: number,
): ReadonlyArray<number> =>
  Arr.makeBy(xs.length, (i) =>
    primitives.octaveNoise2D(xs[i]!, zs[i]!, octaves, persistence, lacunarity),
  )

export const noise2DBatch = (
  primitives: NoisePrimitives,
  points: ReadonlyArray<readonly [number, number]>,
): ReadonlyArray<number> =>
  Arr.map(points, ([x, z]) => primitives.noise2D(x, z))

export const octaveNoise2DBatch = (
  primitives: NoisePrimitives,
  points: ReadonlyArray<readonly [number, number]>,
  octaves: number,
  persistence: number,
  lacunarity: number,
): ReadonlyArray<number> =>
  Arr.map(points, ([x, z]) =>
    primitives.octaveNoise2D(x, z, octaves, persistence, lacunarity),
  )
