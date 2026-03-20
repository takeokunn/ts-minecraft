import { Effect } from 'effect'

/**
 * Application-layer port for noise generation.
 * Decouples application services from the infrastructure Perlin-noise implementation.
 * Wired to infrastructure/noise/NoiseService via NoisePortLayer in src/layers.ts.
 */
export class NoiseServicePort extends Effect.Service<NoiseServicePort>()(
  '@minecraft/application/noise/NoiseServicePort',
  {
    succeed: {
      noise2D: (_x: number, _z: number): Effect.Effect<number, never> => Effect.succeed(0.5),
      octaveNoise2D: (
        _x: number,
        _z: number,
        _octaves: number,
        _persistence: number,
        _lacunarity: number,
      ): Effect.Effect<number, never> => Effect.succeed(0.5),
      setSeed: (_seed: number): Effect.Effect<void, never> => Effect.void,
    },
  }
) {}
