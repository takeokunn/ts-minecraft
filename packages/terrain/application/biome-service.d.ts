import { Effect } from 'effect';
import { NoiseServicePort } from '../domain/noise-service-port';
import type { BiomeType, BiomeProperties } from '../domain/biome';
declare const BiomeService_base: Effect.Service.Class<BiomeService, "@minecraft/application/BiomeService", {
    readonly effect: Effect.Effect<{
        getBiome: (x: number, z: number) => Effect.Effect<BiomeType, never>;
        getBiomeProperties: (biome: BiomeType) => Effect.Effect<BiomeProperties, never, never>;
        getTemperature: (x: number, z: number) => Effect.Effect<number, never>;
        getHumidity: (x: number, z: number) => Effect.Effect<number, never>;
        getBiomesAndPropertiesForChunk: (chunkX: number, chunkZ: number) => Effect.Effect<ReadonlyArray<{
            biome: BiomeType;
            props: BiomeProperties;
        }>>;
    }, never, NoiseServicePort>;
}>;
export declare class BiomeService extends BiomeService_base {
}
export declare const BiomeServiceLive: import("effect/Layer").Layer<BiomeService, never, NoiseServicePort>;
export {};
//# sourceMappingURL=biome-service.d.ts.map