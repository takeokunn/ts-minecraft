import { Array as Arr, Effect } from 'effect'
import { createPerlinNoise2D, createPerlinNoise3D, type NoiseFn2D, type NoiseFn3D, type RandFn } from './perlin'

const mulberry32 = (seed: number): RandFn => {
  let s = seed >>> 0
  return () => {
    let t = (s += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const normalizeNoise = (value: number): number => (value + 1) / 2

// Weyl-constant XORs used to decorrelate per-channel Perlin seeds while keeping
// the derived seed inside uint32 range (see setSeed below).
const WEYL_C = 0x9e3779b1
const WEYL_E = 0xbb67ae85
const WEYL_W = 0x3c6ef372
const WEYL_J = 0xa54ff53a

// Terrain-channel world-space frequencies (blocks^-1). Documented alongside the
// sparse-sample grid so the constants stay close to the code that uses them.
const SCALE_C = 0.0005
const SCALE_E = 0.001
const SCALE_W = 0.002
const SCALE_J = 0.02

// Peaks-and-valleys transform of the weirdness channel.
// pv = 1 - |3|w| - 2|
const toPV = (w: number): number => 1 - Math.abs(3 * Math.abs(w) - 2)

export class NoiseService extends Effect.Service<NoiseService>()(
  '@minecraft/infrastructure/noise/NoiseService',
  {
    effect: Effect.sync(() => {
      let noiseFn: NoiseFn2D = createPerlinNoise2D()
      // 3D noise uses an offset seed so it is uncorrelated with the 2D noise
      // even when both are initialised from the same base seed.
      let noiseFn3D: NoiseFn3D = createPerlinNoise3D()
      // Per-channel Perlin instances — seeded from the base seed via Weyl XORs
      // so each channel is statistically independent of the others.
      let noiseFnContinentalness: NoiseFn2D = createPerlinNoise2D()
      let noiseFnErosion: NoiseFn2D = createPerlinNoise2D()
      let noiseFnWeirdness: NoiseFn2D = createPerlinNoise2D()
      let noiseFnJaggedness: NoiseFn2D = createPerlinNoise2D()
      let currentSeed = 0

      const computeOctaveNoise = (
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

      return {
        noise2D: (x: number, z: number): Effect.Effect<number, never> =>
          Effect.sync(() => normalizeNoise(noiseFn(x, z))),

        octaveNoise2D: (x: number, z: number, octaves: number, persistence: number, lacunarity: number): Effect.Effect<number, never> =>
          Effect.sync(() => computeOctaveNoise(x, z, octaves, persistence, lacunarity)),

        getSeed: (): Effect.Effect<number, never, never> =>
          Effect.sync(() => currentSeed),

        setSeed: (seed: number): Effect.Effect<void, never, never> =>
          Effect.sync(() => {
            currentSeed = seed
            noiseFn = createPerlinNoise2D(mulberry32(seed))
            // Offset the 3D seed so the 3D gradient table is independent of the 2D one.
            // XOR with a large constant keeps the seed inside uint32 range.
            noiseFn3D = createPerlinNoise3D(mulberry32((seed ^ 0x9e3779b9) >>> 0))
            // Terrain-channel decorrelation: XOR with Weyl constants then mask to uint32.
            noiseFnContinentalness = createPerlinNoise2D(mulberry32((seed ^ WEYL_C) >>> 0))
            noiseFnErosion = createPerlinNoise2D(mulberry32((seed ^ WEYL_E) >>> 0))
            noiseFnWeirdness = createPerlinNoise2D(mulberry32((seed ^ WEYL_W) >>> 0))
            noiseFnJaggedness = createPerlinNoise2D(mulberry32((seed ^ WEYL_J) >>> 0))
          }),

        noise3D: (x: number, y: number, z: number): Effect.Effect<number, never> =>
          Effect.sync(() => noiseFn3D(x, y, z)),

        noise3DBatchXYZ: (
          xs: ReadonlyArray<number>,
          ys: ReadonlyArray<number>,
          zs: ReadonlyArray<number>,
        ): Effect.Effect<ReadonlyArray<number>, never> =>
          Effect.sync(() => {
            const length = xs.length
            const values: number[] = []
            values.length = length
            for (let i = 0; i < length; i++) {
              values[i] = noiseFn3D(xs[i]!, ys[i]!, zs[i]!)
            }
            return values
          }),

        octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>, octaves: number, persistence: number, lacunarity: number): Effect.Effect<ReadonlyArray<number>, never> =>
          Effect.sync(() => Arr.map(points, ([x, z]) => computeOctaveNoise(x, z, octaves, persistence, lacunarity))),

        noise2DBatch: (points: ReadonlyArray<readonly [number, number]>): Effect.Effect<ReadonlyArray<number>, never> =>
          Effect.sync(() => Arr.map(points, ([x, z]) => normalizeNoise(noiseFn(x, z)))),

        octaveNoise2DBatchXY: (
          xs: ReadonlyArray<number>,
          zs: ReadonlyArray<number>,
          octaves: number,
          persistence: number,
          lacunarity: number,
        ): Effect.Effect<ReadonlyArray<number>, never> =>
          Effect.sync(() => {
            const length = xs.length
            const values: number[] = []
            values.length = length
            for (let i = 0; i < length; i++) {
              values[i] = computeOctaveNoise(xs[i]!, zs[i]!, octaves, persistence, lacunarity)
            }
            return values
          }),

        noise2DBatchXY: (xs: ReadonlyArray<number>, zs: ReadonlyArray<number>): Effect.Effect<ReadonlyArray<number>, never> =>
          Effect.sync(() => {
            const length = xs.length
            const values: number[] = []
            values.length = length
            for (let i = 0; i < length; i++) {
              values[i] = normalizeNoise(noiseFn(xs[i]!, zs[i]!))
            }
            return values
          }),

        continentalness: (x: number, z: number): Effect.Effect<number, never> =>
          Effect.sync(() => noiseFnContinentalness(x * SCALE_C, z * SCALE_C)),

        erosion: (x: number, z: number): Effect.Effect<number, never> =>
          Effect.sync(() => noiseFnErosion(x * SCALE_E, z * SCALE_E)),

        weirdness: (x: number, z: number): Effect.Effect<number, never> =>
          Effect.sync(() => noiseFnWeirdness(x * SCALE_W, z * SCALE_W)),

        jaggedness: (x: number, z: number): Effect.Effect<number, never> =>
          Effect.sync(() => noiseFnJaggedness(x * SCALE_J, z * SCALE_J)),

        sampleTerrainChannels: (
          xStart: number,
          zStart: number,
        ): Effect.Effect<
          {
            readonly continentalness: Float64Array
            readonly erosion: Float64Array
            readonly pv: Float64Array
            readonly jaggedness: Float64Array
          },
          never
        > =>
          Effect.sync(() => {
            // Sparse 9×9 corner grid (N+1 for bilinear across 16 cells at step=2).
            // Index layout: sparse[sx * 9 + sz] for sx, sz in [0..8].
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

            // Dense 16×16 output via bilinear interpolation. Index: z * 16 + x
            // (matches the consumer in `application/terrain/density-function.ts`).
            // Loop order is z-outer / x-inner so writes are contiguous.
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
          }),
      }
    })
  }
) {}
export const NoiseServiceLive = NoiseService.Default
