import { Effect } from 'effect';
import { BlockType, ChunkCoord } from '@ts-minecraft/kernel';
import type { Chunk } from '../domain/chunk';
import { ChunkError } from '../domain/errors';
declare const ChunkService_base: Effect.Service.Class<ChunkService, "@minecraft/application/ChunkService", {
    readonly effect: Effect.Effect<{
        createChunk: (coord: ChunkCoord) => Effect.Effect<Chunk, never>;
        getBlock: (chunk: Chunk, localX: number, y: number, localZ: number) => Effect.Effect<BlockType, ChunkError>;
        setBlock: (chunk: Chunk, localX: number, y: number, localZ: number, blockType: BlockType) => Effect.Effect<Chunk, ChunkError>;
        worldToChunkCoord: (worldX: number, worldZ: number) => Effect.Effect<ChunkCoord, never, never>;
        chunkToWorldCoord: (coord: ChunkCoord, localX: number, localZ: number) => Effect.Effect<ChunkCoord, never, never>;
    }, never, never>;
}>;
export declare class ChunkService extends ChunkService_base {
}
export declare const ChunkServiceLive: import("effect/Layer").Layer<ChunkService, never, never>;
export {};
//# sourceMappingURL=chunk-service.d.ts.map