import { Array as Arr, Effect } from 'effect';
import { createNoisePrimitives, computeTerrainChannels, } from '../infrastructure/primitives';
// All deterministic noise math now lives in `shared/noise/primitives.ts` so the
// off-thread terrain worker can use the exact same primitives without going
// through the Effect runtime. NoiseService is a thin Effect-wrapper around a
// mutable `NoisePrimitives` reference that gets swapped on `setSeed`.
export class NoiseService extends Effect.Service()('@minecraft/infrastructure/noise/NoiseService', {
    effect: Effect.sync(() => {
        // `let` here, not `Ref`: the surrounding methods are all `Effect.sync`
        // closures over this binding. Identical structure to the previous
        // implementation — preserves the read-modify-write semantics on
        // `setSeed` without introducing scheduling fences.
        let primitives = createNoisePrimitives(0);
        let currentSeed = 0;
        return {
            noise2D: (x, z) => Effect.sync(() => primitives.noise2D(x, z)),
            octaveNoise2D: (x, z, octaves, persistence, lacunarity) => Effect.sync(() => primitives.octaveNoise2D(x, z, octaves, persistence, lacunarity)),
            getSeed: Effect.sync(() => currentSeed),
            setSeed: (seed) => Effect.sync(() => {
                currentSeed = seed;
                primitives = createNoisePrimitives(seed);
            }),
            noise3D: (x, y, z) => Effect.sync(() => primitives.noise3D(x, y, z)),
            noise3DBatchXYZ: (xs, ys, zs) => Effect.sync(() => {
                const length = xs.length;
                const values = [];
                values.length = length;
                // Hot loop: kept as `for` to match the previous performance
                // boundary in `chunk-manager-service.ts`. `Arr.makeBy` would
                // allocate a callback closure once per call site — fine — but
                // the loop body itself stays imperative for throughput.
                for (let i = 0; i < length; i++) {
                    values[i] = primitives.noise3D(xs[i], ys[i], zs[i]);
                }
                return values;
            }),
            octaveNoise2DBatch: (points, octaves, persistence, lacunarity) => Effect.sync(() => Arr.map(points, ([x, z]) => primitives.octaveNoise2D(x, z, octaves, persistence, lacunarity))),
            noise2DBatch: (points) => Effect.sync(() => Arr.map(points, ([x, z]) => primitives.noise2D(x, z))),
            octaveNoise2DBatchXY: (xs, zs, octaves, persistence, lacunarity) => Effect.sync(() => {
                const length = xs.length;
                const values = [];
                values.length = length;
                for (let i = 0; i < length; i++) {
                    values[i] = primitives.octaveNoise2D(xs[i], zs[i], octaves, persistence, lacunarity);
                }
                return values;
            }),
            noise2DBatchXY: (xs, zs) => Effect.sync(() => {
                const length = xs.length;
                const values = [];
                values.length = length;
                for (let i = 0; i < length; i++) {
                    values[i] = primitives.noise2D(xs[i], zs[i]);
                }
                return values;
            }),
            continentalness: (x, z) => Effect.sync(() => primitives.continentalnessAt(x, z)),
            erosion: (x, z) => Effect.sync(() => primitives.erosionAt(x, z)),
            weirdness: (x, z) => Effect.sync(() => primitives.weirdnessAt(x, z)),
            jaggedness: (x, z) => Effect.sync(() => primitives.jaggednessAt(x, z)),
            sampleTerrainChannels: (xStart, zStart) => Effect.sync(() => computeTerrainChannels(primitives.continentalness, primitives.erosion, primitives.weirdness, primitives.jaggedness, xStart, zStart)),
        };
    }),
}) {
}
export const NoiseServiceLive = NoiseService.Default;
//# sourceMappingURL=noise-service.js.map