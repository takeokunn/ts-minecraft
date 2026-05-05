import type { BiomeType } from './biome';
export type ClimateSample = {
    readonly temperature: number;
    readonly humidity: number;
    readonly continentalness: number;
    readonly erosion: number;
    readonly pv: number;
    readonly riverNoise: number;
};
export declare const peaksAndValleysFromWeirdness: (weirdness: number) => number;
export declare const classifyBiome: (temperature: number, humidity: number) => BiomeType;
export declare const classifyBiomeFromClimate: ({ temperature, humidity, continentalness, erosion, pv, riverNoise, }: ClimateSample) => BiomeType;
export declare const refineBeachBiome: (biome: BiomeType, neighboringBiomes: ReadonlyArray<BiomeType>, continentalness: number) => BiomeType;
export type ChunkNoiseCoord = {
    readonly tempX: number;
    readonly tempZ: number;
    readonly humX: number;
    readonly humZ: number;
};
export declare const buildChunkNoiseInputs: (chunkX: number, chunkZ: number) => ReadonlyArray<ChunkNoiseCoord>;
export declare const batchTerrainIndexFor: (i: number) => number;
//# sourceMappingURL=biome-classifier.d.ts.map