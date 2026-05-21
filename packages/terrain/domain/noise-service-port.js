import { Array as Arr, Effect } from 'effect';
// Application-layer port for noise generation.
// Decouples application services from the infrastructure Perlin-noise implementation.
// Wired to infrastructure/noise/NoiseService via NoisePortLayer in src/layers.ts.
export class NoiseServicePort extends Effect.Service()('@minecraft/application/noise/NoiseServicePort', {
    succeed: {
        /* c8 ignore next 2 */
        noise2D: (_x, _z) => Effect.succeed(0.5),
        /* c8 ignore next 7 */
        octaveNoise2D: (_x, _z, _octaves, _persistence, _lacunarity) => Effect.succeed(0.5),
        /* c8 ignore next */
        setSeed: (_seed) => Effect.void,
        getSeed: Effect.succeed(0),
        /* c8 ignore next 6 */
        octaveNoise2DBatch: (points, _octaves, _persistence, _lacunarity) => Effect.succeed(Arr.makeBy(points.length, () => 0.5)),
        /* c8 ignore next 7 */
        octaveNoise2DBatchXY: (xs, _zs, _octaves, _persistence, _lacunarity) => Effect.succeed(Arr.makeBy(xs.length, () => 0.5)),
        /* c8 ignore next 3 */
        noise2DBatch: (points) => Effect.succeed(Arr.makeBy(points.length, () => 0.5)),
        /* c8 ignore next 4 */
        noise2DBatchXY: (xs, _zs) => Effect.succeed(Arr.makeBy(xs.length, () => 0.5)),
        /* c8 ignore next 5 */
        noise3D: (_x, _y, _z) => Effect.succeed(0),
        /* c8 ignore next 5 */
        noise3DBatchXYZ: (xs, _ys, _zs) => Effect.succeed(Arr.makeBy(xs.length, () => 0)),
        /* c8 ignore next 4 */
        continentalness: (_x, _z) => Effect.succeed(0),
        erosion: (_x, _z) => Effect.succeed(0),
        weirdness: (_x, _z) => Effect.succeed(0),
        jaggedness: (_x, _z) => Effect.succeed(0),
        /* c8 ignore next 18 */
        sampleTerrainChannels: (_xStart, _zStart) => Effect.succeed({
            continentalness: new Float64Array(256),
            erosion: new Float64Array(256),
            pv: new Float64Array(256),
            jaggedness: new Float64Array(256),
        }),
    },
}) {
}
//# sourceMappingURL=../../../dist/packages/terrain/domain/noise-service-port.js.map