import { Effect, Option } from 'effect';
import { ChunkService } from './chunk-service';
import type { Chunk } from '../domain/chunk';
import { ChunkCoord, type WorldId } from '@ts-minecraft/kernel';
import { StorageError } from '@ts-minecraft/world-state';
import { LightEngineService } from './light-engine-service';
import { StorageServicePort } from '../domain/storage-service-port';
import { Position } from '@ts-minecraft/kernel';
import { BiomeService } from './biome-service';
import { NoiseServicePort } from '../domain/noise-service-port';
import { TerrainWorkerPoolPort } from './terrain-worker-pool-port';
import { ChunkManagerError } from './chunk-manager-constants';
export { RENDER_DISTANCE, UNLOAD_DISTANCE, MAX_CACHED_CHUNKS } from './chunk-manager-constants';
export type { ChunkManagerError } from './chunk-manager-constants';
type ChunkLoadOptions = {
    readonly eager?: boolean;
};
export declare const setActiveChunkWorldId: (worldId: WorldId) => void;
declare const ChunkManagerService_base: Effect.Service.Class<ChunkManagerService, "@minecraft/application/ChunkManagerService", {
    readonly effect: Effect.Effect<{
        getChunk: (coord: ChunkCoord) => Effect.Effect<{
            readonly coord: {
                readonly x: number;
                readonly z: number;
            };
            readonly blocks: Uint8Array<ArrayBufferLike>;
            readonly fluid: Option.Option<Uint8Array<ArrayBufferLike>>;
            readonly skyLight?: Uint8Array<ArrayBufferLike> | undefined;
            readonly blockLight?: Uint8Array<ArrayBufferLike> | undefined;
        }, ChunkManagerError, never>;
        loadChunksAroundPlayer: (playerPos: Position, renderDistance?: number, options?: ChunkLoadOptions) => Effect.Effect<boolean, ChunkManagerError>;
        getLoadedChunks: () => Effect.Effect<ReadonlyArray<Chunk>, never>;
        drainRenderDirtyChunks: () => Effect.Effect<ReadonlyArray<Chunk>, never>;
        markChunkDirty: (coord: ChunkCoord) => Effect.Effect<void, never>;
        saveDirtyChunks: () => Effect.Effect<void, StorageError>;
        unloadChunk: (coord: ChunkCoord) => Effect.Effect<void, StorageError, never>;
    }, never, ChunkService | NoiseServicePort | BiomeService | StorageServicePort | TerrainWorkerPoolPort | LightEngineService>;
}>;
export declare class ChunkManagerService extends ChunkManagerService_base {
}
export declare const ChunkManagerServiceLive: import("effect/Layer").Layer<ChunkManagerService, never, ChunkService | NoiseServicePort | BiomeService | StorageServicePort | TerrainWorkerPoolPort | LightEngineService>;
//# sourceMappingURL=chunk-manager-service.d.ts.map
