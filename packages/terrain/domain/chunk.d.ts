import { Effect, Schema } from 'effect';
import { BlockType, BlockIndexError } from '@ts-minecraft/kernel';
export declare const WORLD_SCHEMA_VERSION = 3;
export declare const ChunkSchema: Schema.Struct<{
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
export type Chunk = Schema.Schema.Type<typeof ChunkSchema>;
export declare const getBlocksBatch: (chunk: Chunk) => Effect.Effect<Readonly<Uint8Array>, never>;
export declare const setBlockInChunk: (chunk: Chunk, localX: number, y: number, localZ: number, blockType: BlockType) => Effect.Effect<void, BlockIndexError>;
//# sourceMappingURL=chunk.d.ts.map