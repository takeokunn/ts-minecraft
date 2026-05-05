import { Effect } from 'effect';
import { type TerrainChannelSamples } from '../infrastructure/primitives';
declare const NoiseService_base: Effect.Service.Class<NoiseService, "@minecraft/infrastructure/noise/NoiseService", {
    readonly effect: Effect.Effect<{
        noise2D: (x: number, z: number) => Effect.Effect<number, never>;
        octaveNoise2D: (x: number, z: number, octaves: number, persistence: number, lacunarity: number) => Effect.Effect<number, never>;
        getSeed: Effect.Effect<number, never, never>;
        setSeed: (seed: number) => Effect.Effect<void, never, never>;
        noise3D: (x: number, y: number, z: number) => Effect.Effect<number, never>;
        noise3DBatchXYZ: (xs: ReadonlyArray<number>, ys: ReadonlyArray<number>, zs: ReadonlyArray<number>) => Effect.Effect<ReadonlyArray<number>, never>;
        octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>, octaves: number, persistence: number, lacunarity: number) => Effect.Effect<ReadonlyArray<number>, never>;
        noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) => Effect.Effect<ReadonlyArray<number>, never>;
        octaveNoise2DBatchXY: (xs: ReadonlyArray<number>, zs: ReadonlyArray<number>, octaves: number, persistence: number, lacunarity: number) => Effect.Effect<ReadonlyArray<number>, never>;
        noise2DBatchXY: (xs: ReadonlyArray<number>, zs: ReadonlyArray<number>) => Effect.Effect<ReadonlyArray<number>, never>;
        continentalness: (x: number, z: number) => Effect.Effect<number, never>;
        erosion: (x: number, z: number) => Effect.Effect<number, never>;
        weirdness: (x: number, z: number) => Effect.Effect<number, never>;
        jaggedness: (x: number, z: number) => Effect.Effect<number, never>;
        sampleTerrainChannels: (xStart: number, zStart: number) => Effect.Effect<TerrainChannelSamples, never>;
    }, never, never>;
}>;
export declare class NoiseService extends NoiseService_base {
}
export declare const NoiseServiceLive: import("effect/Layer").Layer<NoiseService, never, never>;
export {};
//# sourceMappingURL=noise-service.d.ts.map