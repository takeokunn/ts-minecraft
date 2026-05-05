import { Schema } from 'effect';
import { ChunkSchema } from '../domain/chunk';
import { FLUID_BYTE_LENGTH, createFluidBuffer } from '@ts-minecraft/world-state';
const isStoredRecord = (value) => typeof value === 'object' && value !== null;
const storedBlocksBuffer = (value) => {
    if (value instanceof Uint8Array) {
        return value;
    }
    if (isStoredRecord(value) && value['blocks'] instanceof Uint8Array) {
        return value['blocks'];
    }
    return new Uint8Array(0);
};
export const storedFluidBuffer = (value) => value instanceof Uint8Array && value.byteLength === FLUID_BYTE_LENGTH ? value : createFluidBuffer();
export const storedChunkPayload = (stored) => {
    return {
        blocks: storedBlocksBuffer(stored),
        fluid: storedFluidBuffer(isStoredRecord(stored) ? stored['fluid'] : undefined),
    };
};
// lastAccessed is intentionally mutable for O(1) in-place LRU updates.
export const ChunkCacheEntrySchema = Schema.mutable(Schema.Struct({
    chunk: ChunkSchema, // ChunkSchema defined in src/domain/chunk.ts
    lastAccessed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()), // mutable for O(1) LRU in-place updates
}));
//# sourceMappingURL=chunk-manager-cache.js.map