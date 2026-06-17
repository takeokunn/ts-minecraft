// Pure domain types for noise primitives — no infrastructure dependency.

import { CHUNK_SIZE } from '@ts-minecraft/core'
import { createPerlinNoise2D, createPerlinNoise3D } from './perlin'

export type RandFn = () => number
export type NoiseFn2D = (x: number, z: number) => number
export type NoiseFn3D = (x: number, y: number, z: number) => number
type TerrainBatchPoint2D = readonly [number, number]

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

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

// Map 2D Perlin output from [-1, 1] to [0, 1].
export const normalizeNoise = (value: number): number => (value + 1) / 2
export const CHUNK_COLUMN_SAMPLE_COUNT = CHUNK_SIZE * CHUNK_SIZE

// Weyl-constant XORs decorrelate per-channel Perlin seeds while keeping every
// derived seed inside uint32 range.
export const WEYL_C = 0x9e3779b1
export const WEYL_E = 0xbb67ae85
export const WEYL_W = 0x3c6ef372
export const WEYL_J = 0xa54ff53a
export const WEYL_3D = 0x9e3779b9

// Terrain-channel world-space frequencies (blocks^-1).
export const SCALE_C = 0.0005
export const SCALE_E = 0.001
export const SCALE_W = 0.002
export const SCALE_J = 0.02

// pv = 1 - |3|w| - 2|
export const toPV = (w: number): number => 1 - Math.abs(3 * Math.abs(w) - 2)

const readCoordinate = (values: ReadonlyArray<number>, index: number): number => values[index] ?? Number.NaN
const readChannelSample = (values: Float64Array, index: number): number => values[index] ?? Number.NaN
const readBatchPoint2D = (points: ReadonlyArray<TerrainBatchPoint2D>, index: number): TerrainBatchPoint2D =>
  points[index] ?? [Number.NaN, Number.NaN]

const blendSparseChannelSample = (
  values: Float64Array,
  i00: number,
  i10: number,
  i01: number,
  i11: number,
  w00: number,
  w10: number,
  w01: number,
  w11: number,
): number =>
  w00 * readChannelSample(values, i00) +
  w10 * readChannelSample(values, i10) +
  w01 * readChannelSample(values, i01) +
  w11 * readChannelSample(values, i11)

// ---------------------------------------------------------------------------
// Octave-noise core.
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
  for (let i = 0; i < octaves; i++) {
    total += noiseFn(x * frequency, z * frequency) * amplitude
    maxValue += amplitude
    amplitude *= persistence
    frequency *= lacunarity
  }
  return normalizeNoise(total / maxValue)
}

// ---------------------------------------------------------------------------
// Sparse-grid bilinear-interpolated terrain channel sampler.
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
  // Sample noise on a coarse grid (every STEP blocks) then bilinearly upsample to
  // the full chunk column — far cheaper than per-block noise without visible seams.
  const STEP = 2
  const SPARSE = CHUNK_SIZE / STEP + 1 // grid points needed to span [0, CHUNK_SIZE] inclusive
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

  const continentalness = new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT)
  const erosion = new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT)
  const pv = new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT)
  const jaggedness = new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT)

  for (let z = 0; z < CHUNK_SIZE; z++) {
    const siz = z >> 1
    const fz = (z & 1) / 2
    const inv_fz = 1 - fz
    for (let x = 0; x < CHUNK_SIZE; x++) {
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

      const c = blendSparseChannelSample(sparseC, i00, i10, i01, i11, w00, w10, w01, w11)
      const e = blendSparseChannelSample(sparseE, i00, i10, i01, i11, w00, w10, w01, w11)
      const w = blendSparseChannelSample(sparseW, i00, i10, i01, i11, w00, w10, w01, w11)
      const j = blendSparseChannelSample(sparseJ, i00, i10, i01, i11, w00, w10, w01, w11)

      const out = z * CHUNK_SIZE + x
      continentalness[out] = c
      erosion[out] = e
      pv[out] = toPV(w)
      jaggedness[out] = j
    }
  }

  return { continentalness, erosion, pv, jaggedness }
}

// ---------------------------------------------------------------------------
// Noise primitives bundle type.
// ---------------------------------------------------------------------------
export type NoisePrimitives = Readonly<{
  raw2D: NoiseFn2D
  raw3D: NoiseFn3D
  continentalness: NoiseFn2D
  erosion: NoiseFn2D
  weirdness: NoiseFn2D
  jaggedness: NoiseFn2D
  noise2D: (x: number, z: number) => number
  octaveNoise2D: (x: number, z: number, octaves: number, persistence: number, lacunarity: number) => number
  noise3D: (x: number, y: number, z: number) => number
  continentalnessAt: (x: number, z: number) => number
  erosionAt: (x: number, z: number) => number
  weirdnessAt: (x: number, z: number) => number
  jaggednessAt: (x: number, z: number) => number
  sampleTerrainChannels: (xStart: number, zStart: number) => TerrainChannelSamples
}>

// ---------------------------------------------------------------------------
// Full noise primitives factory — seeds every Perlin channel from a single seed.
// ---------------------------------------------------------------------------
export const createNoisePrimitives = (seed: number): NoisePrimitives => {
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
// Batch helpers
// ---------------------------------------------------------------------------
export const noise2DBatchXY = (
  primitives: NoisePrimitives,
  xs: ReadonlyArray<number>,
  zs: ReadonlyArray<number>,
): ReadonlyArray<number> => {
  const out = Array<number>(xs.length)
  for (let i = 0; i < xs.length; i++) {
    out[i] = primitives.noise2D(readCoordinate(xs, i), readCoordinate(zs, i))
  }
  return out
}

export const noise3DBatchXYZ = (
  primitives: NoisePrimitives,
  xs: ReadonlyArray<number>,
  ys: ReadonlyArray<number>,
  zs: ReadonlyArray<number>,
): ReadonlyArray<number> => {
  const out = Array<number>(xs.length)
  for (let i = 0; i < xs.length; i++) {
    out[i] = primitives.noise3D(readCoordinate(xs, i), readCoordinate(ys, i), readCoordinate(zs, i))
  }
  return out
}

export const octaveNoise2DBatchXY = (
  primitives: NoisePrimitives,
  xs: ReadonlyArray<number>,
  zs: ReadonlyArray<number>,
  octaves: number,
  persistence: number,
  lacunarity: number,
): ReadonlyArray<number> => {
  const out = Array<number>(xs.length)
  for (let i = 0; i < xs.length; i++) {
    out[i] = primitives.octaveNoise2D(readCoordinate(xs, i), readCoordinate(zs, i), octaves, persistence, lacunarity)
  }
  return out
}

export const noise2DBatch = (
  primitives: NoisePrimitives,
  points: ReadonlyArray<TerrainBatchPoint2D>,
): ReadonlyArray<number> => {
  const out = Array<number>(points.length)
  for (let i = 0; i < points.length; i++) {
    const [x, z] = readBatchPoint2D(points, i)
    out[i] = primitives.noise2D(x, z)
  }
  return out
}

export const octaveNoise2DBatch = (
  primitives: NoisePrimitives,
  points: ReadonlyArray<TerrainBatchPoint2D>,
  octaves: number,
  persistence: number,
  lacunarity: number,
): ReadonlyArray<number> => {
  const out = Array<number>(points.length)
  for (let i = 0; i < points.length; i++) {
    const [x, z] = readBatchPoint2D(points, i)
    out[i] = primitives.octaveNoise2D(x, z, octaves, persistence, lacunarity)
  }
  return out
}
