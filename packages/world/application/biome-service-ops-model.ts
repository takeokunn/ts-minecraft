import { Effect } from "effect";

export type NoiseServiceLike = {
  octaveNoise2D: (
    x: number,
    z: number,
    octaves: number,
    persistence: number,
    lacunarity: number,
  ) => Effect.Effect<number, never>;
  noise2D: (x: number, z: number) => Effect.Effect<number, never>;
  octaveNoise2DBatchXY: (
    xs: ReadonlyArray<number>,
    zs: ReadonlyArray<number>,
    octaves: number,
    persistence: number,
    lacunarity: number,
  ) => Effect.Effect<ReadonlyArray<number>>;
  noise2DBatchXY: (
    xs: ReadonlyArray<number>,
    zs: ReadonlyArray<number>,
  ) => Effect.Effect<ReadonlyArray<number>>;
  sampleTerrainChannels: (
    xStart: number,
    zStart: number,
  ) => Effect.Effect<{
    readonly continentalness: Float64Array;
    readonly erosion: Float64Array;
    readonly pv: Float64Array;
    readonly jaggedness: Float64Array;
  }>;
  continentalness: (x: number, z: number) => Effect.Effect<number, never>;
  erosion: (x: number, z: number) => Effect.Effect<number, never>;
  weirdness: (x: number, z: number) => Effect.Effect<number, never>;
};
