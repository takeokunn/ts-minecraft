import { HashSet, HashMap, Schema } from 'effect';
import type { ChunkCacheKey } from '@ts-minecraft/kernel';
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
}>>;
export type ChunkCacheEntry = Schema.Schema.Type<typeof ChunkCacheEntrySchema>;
export type ChunkCache = {
    chunks: HashMap.HashMap<ChunkCacheKey, ChunkCacheEntry>;
    dirtyChunks: HashSet.HashSet<ChunkCacheKey>;
};
//# sourceMappingURL=chunk-manager-cache.d.ts.map