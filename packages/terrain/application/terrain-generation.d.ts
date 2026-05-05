import { Effect, Layer, Metric, Schema } from 'effect';
import { ChunkService } from './chunk-service';
import type { ChunkCoord } from '@ts-minecraft/kernel';
import { BiomeService } from './biome-service';
import { NoiseServicePort } from '../domain/noise-service-port';
export declare const chunkLoadHistogram: Metric.Metric<import("effect/MetricKeyType").MetricKeyType.Histogram, number, import("effect/MetricState").MetricState.Histogram>;
export declare const TerrainGenerationInputSchema: Schema.Struct<{
    coord: Schema.Struct<{
        x: Schema.filter<typeof Schema.Number>;
        z: Schema.filter<typeof Schema.Number>;
    }>;
    seaLevel: Schema.filter<Schema.filter<typeof Schema.Number>>;
    lakeLevel: Schema.filter<Schema.filter<typeof Schema.Number>>;
    seed: Schema.filter<typeof Schema.Number>;
}>;
export type TerrainGenerationInput = Schema.Schema.Type<typeof TerrainGenerationInputSchema>;
export type ChunkBlocks = Readonly<{
    blocks: Uint8Array;
    skyLight: Uint8Array;
    blockLight: Uint8Array;
}>;
export declare const buildTerrainLayer: (seed: number) => Layer.Layer<ChunkService | BiomeService | NoiseServicePort>;
export type ColumnNoiseCoord = Readonly<{
    wx: number;
    wz: number;
}>;
export declare const createTerrainNoiseCoordinates: (coord: ChunkCoord) => ReadonlyArray<ColumnNoiseCoord>;
export declare const buildTerrainProgram: (coord: ChunkCoord) => Effect.Effect<{
    readonly coord: {
        readonly x: number;
        readonly z: number;
    };
    readonly blocks: Uint8Array<ArrayBufferLike>;
    readonly fluid: import("effect/Option").Option<Uint8Array<ArrayBufferLike>>;
    readonly skyLight?: Uint8Array<ArrayBufferLike> | undefined;
    readonly blockLight?: Uint8Array<ArrayBufferLike> | undefined;
}, never, ChunkService | NoiseServicePort | BiomeService>;
export declare const toChunkBlocks: (chunk: {
    blocks: Uint8Array;
}) => ChunkBlocks;
export declare const generateTerrainBlocks: (input: TerrainGenerationInput) => ChunkBlocks;
//# sourceMappingURL=terrain-generation.d.ts.map