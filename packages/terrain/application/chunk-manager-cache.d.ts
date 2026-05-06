import { HashSet, HashMap, Schema } from 'effect';
import type { ChunkCacheKey, WorldId } from '@ts-minecraft/kernel';
export declare const storedFluidBuffer: (value: unknown) => Uint8Array<ArrayBufferLike>;
export declare const storedChunkPayload: (stored: unknown) => {
    blocks: Uint8Array<ArrayBufferLike>;
    fluid: Uint8Array<ArrayBufferLike>;
};
export declare const ChunkCacheEntrySchema: Schema.mutable<Schema.Struct<{
    chunk: Schema.Struct<{
        coord: Schema.Struct<{
            x: Schema.filter<typeof Schema.Number>;
            z: Schema.filter<typeof Schema.Number>;
        }>;
        blocks: Schema.declare<Uint8Array<ArrayBufferLike>, Uint8Array<ArrayBufferLike>, readonly [], never>;
        fluid: Schema.optionalWith<Schema.declare<Uint8Array<ArrayBufferLike>, Uint8Array<ArrayBufferLike>, readonly [], never>, {
            as: "Option";
        }>;
        skyLight: Schema.optional<Schema.declare<Uint8Array<ArrayBufferLike>, Uint8Array<ArrayBufferLike>, readonly [], never>>;
        blockLight: Schema.optional<Schema.declare<Uint8Array<ArrayBufferLike>, Uint8Array<ArrayBufferLike>, readonly [], never>>;
    }>;
    lastAccessed: Schema.filter<Schema.filter<typeof Schema.Number>>;
    worldId: Schema.optional<typeof Schema.String>;
}>>;
export type ChunkCacheEntry = {
    chunk: Schema.Schema.Type<typeof ChunkCacheEntrySchema>['chunk'];
    lastAccessed: number;
    worldId?: WorldId;
};
export type ChunkCache = {
    chunks: HashMap.HashMap<ChunkCacheKey, ChunkCacheEntry>;
    dirtyChunks: HashSet.HashSet<ChunkCacheKey>;
    renderDirtyChunks: HashSet.HashSet<ChunkCacheKey>;
};
//# sourceMappingURL=chunk-manager-cache.d.ts.map
