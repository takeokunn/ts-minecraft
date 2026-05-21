// Single source of truth for deterministic noise functions shared by NoiseService and the terrain worker.
// Determinism contract: createNoisePrimitives(seed) output is byte-identical to NoiseService.setSeed(seed).
import { Array as Arr, Effect } from 'effect';
import { NoiseServicePort } from '../domain/noise-service-port';
import { createPerlinNoise2D, createPerlinNoise3D, } from './perlin';
// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------
export const mulberry32 = (seed) => {
    let s = seed >>> 0;
    return () => {
        let t = (s += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
// Map 2D Perlin output from [-1, 1] to [0, 1].
export const normalizeNoise = (value) => (value + 1) / 2;
// Weyl-constant XORs decorrelate per-channel Perlin seeds while keeping every
// derived seed inside uint32 range. Identical to the constants in `application/noise-service.ts` — shared here
// so both the Effect service and the pure terrain worker use the same values.
export const WEYL_C = 0x9e3779b1;
export const WEYL_E = 0xbb67ae85;
export const WEYL_W = 0x3c6ef372;
export const WEYL_J = 0xa54ff53a;
export const WEYL_3D = 0x9e3779b9; // 3D-vs-2D decorrelation offset
// Terrain-channel world-space frequencies (blocks^-1).
export const SCALE_C = 0.0005;
export const SCALE_E = 0.001;
export const SCALE_W = 0.002;
export const SCALE_J = 0.02;
// pv = 1 - |3|w| - 2|  (peaks-and-valleys transform of weirdness)
export const toPV = (w) => 1 - Math.abs(3 * Math.abs(w) - 2);
// ---------------------------------------------------------------------------
// Octave-noise core. Pure: takes a `NoiseFn2D` and a sample point.
// Output range matches `noise-service.ts` exactly.
// ---------------------------------------------------------------------------
export const computeOctaveNoise = (noiseFn, x, z, octaves, persistence, lacunarity) => {
    if (octaves < 1)
        return 0;
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    // Hot inner loop — kept as `for` to avoid per-iteration closure allocation
    // in a function called millions of times per chunk.
    for (let i = 0; i < octaves; i++) {
        total += noiseFn(x * frequency, z * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return normalizeNoise(total / maxValue);
};
export const computeTerrainChannels = (noiseFnContinentalness, noiseFnErosion, noiseFnWeirdness, noiseFnJaggedness, xStart, zStart) => {
    // Sparse 9×9 corner grid — N+1 for bilinear over 16 cells with step=2.
    const SPARSE = 9;
    const STEP = 2;
    const sparseC = new Float64Array(SPARSE * SPARSE);
    const sparseE = new Float64Array(SPARSE * SPARSE);
    const sparseW = new Float64Array(SPARSE * SPARSE);
    const sparseJ = new Float64Array(SPARSE * SPARSE);
    for (let sx = 0; sx < SPARSE; sx++) {
        const wx = xStart + sx * STEP;
        for (let sz = 0; sz < SPARSE; sz++) {
            const wz = zStart + sz * STEP;
            const si = sx * SPARSE + sz;
            sparseC[si] = noiseFnContinentalness(wx * SCALE_C, wz * SCALE_C);
            sparseE[si] = noiseFnErosion(wx * SCALE_E, wz * SCALE_E);
            sparseW[si] = noiseFnWeirdness(wx * SCALE_W, wz * SCALE_W);
            sparseJ[si] = noiseFnJaggedness(wx * SCALE_J, wz * SCALE_J);
        }
    }
    // Dense 16×16 output via bilinear interpolation. Index: z * 16 + x.
    const continentalness = new Float64Array(256);
    const erosion = new Float64Array(256);
    const pv = new Float64Array(256);
    const jaggedness = new Float64Array(256);
    for (let z = 0; z < 16; z++) {
        const siz = z >> 1;
        const fz = (z & 1) / 2;
        const inv_fz = 1 - fz;
        for (let x = 0; x < 16; x++) {
            const six = x >> 1;
            const fx = (x & 1) / 2;
            const inv_fx = 1 - fx;
            const i00 = six * SPARSE + siz;
            const i10 = (six + 1) * SPARSE + siz;
            const i01 = six * SPARSE + (siz + 1);
            const i11 = (six + 1) * SPARSE + (siz + 1);
            const w00 = inv_fx * inv_fz;
            const w10 = fx * inv_fz;
            const w01 = inv_fx * fz;
            const w11 = fx * fz;
            const c = w00 * sparseC[i00] + w10 * sparseC[i10] + w01 * sparseC[i01] + w11 * sparseC[i11];
            const e = w00 * sparseE[i00] + w10 * sparseE[i10] + w01 * sparseE[i01] + w11 * sparseE[i11];
            const w = w00 * sparseW[i00] + w10 * sparseW[i10] + w01 * sparseW[i01] + w11 * sparseW[i11];
            const j = w00 * sparseJ[i00] + w10 * sparseJ[i10] + w01 * sparseJ[i01] + w11 * sparseJ[i11];
            const out = z * 16 + x;
            continentalness[out] = c;
            erosion[out] = e;
            pv[out] = toPV(w);
            jaggedness[out] = j;
        }
    }
    return { continentalness, erosion, pv, jaggedness };
};
export const createNoisePrimitives = (seed) => {
    // Seed each Perlin grid via a Weyl-constant-decorrelated mulberry32 stream.
    const raw2D = createPerlinNoise2D(mulberry32(seed));
    const raw3D = createPerlinNoise3D(mulberry32((seed ^ WEYL_3D) >>> 0));
    const continentalness = createPerlinNoise2D(mulberry32((seed ^ WEYL_C) >>> 0));
    const erosion = createPerlinNoise2D(mulberry32((seed ^ WEYL_E) >>> 0));
    const weirdness = createPerlinNoise2D(mulberry32((seed ^ WEYL_W) >>> 0));
    const jaggedness = createPerlinNoise2D(mulberry32((seed ^ WEYL_J) >>> 0));
    return {
        raw2D,
        raw3D,
        continentalness,
        erosion,
        weirdness,
        jaggedness,
        noise2D: (x, z) => normalizeNoise(raw2D(x, z)),
        octaveNoise2D: (x, z, octaves, persistence, lacunarity) => computeOctaveNoise(raw2D, x, z, octaves, persistence, lacunarity),
        noise3D: (x, y, z) => raw3D(x, y, z),
        continentalnessAt: (x, z) => continentalness(x * SCALE_C, z * SCALE_C),
        erosionAt: (x, z) => erosion(x * SCALE_E, z * SCALE_E),
        weirdnessAt: (x, z) => weirdness(x * SCALE_W, z * SCALE_W),
        jaggednessAt: (x, z) => jaggedness(x * SCALE_J, z * SCALE_J),
        sampleTerrainChannels: (xStart, zStart) => computeTerrainChannels(continentalness, erosion, weirdness, jaggedness, xStart, zStart),
    };
};
// ---------------------------------------------------------------------------
// Batch helpers — convenience wrappers that build typed arrays from the
// primitives. Used by both `noise-service.ts` (to satisfy the Effect API
// surface) and the worker (to mirror the same shape).
// ---------------------------------------------------------------------------
export const noise2DBatchXY = (primitives, xs, zs) => Arr.makeBy(xs.length, (i) => primitives.noise2D(xs[i], zs[i]));
export const noise3DBatchXYZ = (primitives, xs, ys, zs) => Arr.makeBy(xs.length, (i) => primitives.noise3D(xs[i], ys[i], zs[i]));
export const octaveNoise2DBatchXY = (primitives, xs, zs, octaves, persistence, lacunarity) => Arr.makeBy(xs.length, (i) => primitives.octaveNoise2D(xs[i], zs[i], octaves, persistence, lacunarity));
export const noise2DBatch = (primitives, points) => Arr.map(points, ([x, z]) => primitives.noise2D(x, z));
export const octaveNoise2DBatch = (primitives, points, octaves, persistence, lacunarity) => Arr.map(points, ([x, z]) => primitives.octaveNoise2D(x, z, octaves, persistence, lacunarity));
// ---------------------------------------------------------------------------
// Effect-wrapped port factory — converts a fixed-seed NoisePrimitives bundle
// into a NoiseServicePort implementation. Used by the terrain worker (fixed
// seed per chunk batch) and for test layers that don't need setSeed.
// ---------------------------------------------------------------------------
export const buildNoisePortFromPrimitives = (primitives, seed) => NoiseServicePort.of({
    _tag: '@minecraft/application/noise/NoiseServicePort',
    noise2D: (x, z) => Effect.sync(() => primitives.noise2D(x, z)),
    octaveNoise2D: (x, z, octaves, persistence, lacunarity) => Effect.sync(() => primitives.octaveNoise2D(x, z, octaves, persistence, lacunarity)),
    setSeed: (_seed) => Effect.void,
    getSeed: Effect.succeed(seed),
    noise3D: (x, y, z) => Effect.sync(() => primitives.noise3D(x, y, z)),
    noise3DBatchXYZ: (xs, ys, zs) => Effect.sync(() => noise3DBatchXYZ(primitives, xs, ys, zs)),
    octaveNoise2DBatch: (points, octaves, persistence, lacunarity) => Effect.sync(() => octaveNoise2DBatch(primitives, points, octaves, persistence, lacunarity)),
    noise2DBatch: (points) => Effect.sync(() => noise2DBatch(primitives, points)),
    octaveNoise2DBatchXY: (xs, zs, octaves, persistence, lacunarity) => Effect.sync(() => octaveNoise2DBatchXY(primitives, xs, zs, octaves, persistence, lacunarity)),
    noise2DBatchXY: (xs, zs) => Effect.sync(() => noise2DBatchXY(primitives, xs, zs)),
    continentalness: (x, z) => Effect.sync(() => primitives.continentalnessAt(x, z)),
    erosion: (x, z) => Effect.sync(() => primitives.erosionAt(x, z)),
    weirdness: (x, z) => Effect.sync(() => primitives.weirdnessAt(x, z)),
    jaggedness: (x, z) => Effect.sync(() => primitives.jaggednessAt(x, z)),
    sampleTerrainChannels: (xStart, zStart) => Effect.sync(() => computeTerrainChannels(primitives.continentalness, primitives.erosion, primitives.weirdness, primitives.jaggedness, xStart, zStart)),
});
//# sourceMappingURL=../../../dist/packages/terrain/infrastructure/primitives.js.map